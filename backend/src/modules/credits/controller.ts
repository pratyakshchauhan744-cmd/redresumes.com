import { Request, Response, NextFunction } from "express";
import Razorpay from "razorpay";
import crypto from "crypto";
import { prisma } from "../../db/prisma.js";
import { env } from "../../config/env.js";
import { PACKAGES } from "../../config/packages.js";

// Initialize Razorpay conditionally
const razorpay = env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET
  ? new Razorpay({
      key_id: env.RAZORPAY_KEY_ID,
      key_secret: env.RAZORPAY_KEY_SECRET,
    })
  : null;

export async function createCheckoutSession(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const { packageKey } = req.body;

    if (!packageKey || !PACKAGES[packageKey]) {
      return res.status(400).json({ message: "Invalid package key selected" });
    }

    const pkg = PACKAGES[packageKey];
    const frontendOrigin = env.FRONTEND_ORIGIN || "http://localhost:3000";

    // Dev mode / Mock Checkout bypass if Razorpay keys are missing
    if (!razorpay) {
      if (env.NODE_ENV === "production") {
        console.error("CRITICAL: Razorpay keys are missing in production environment!");
        return res.status(500).json({ message: "Payment gateway configuration error. Please contact support." });
      }

      console.warn("Razorpay keys are missing. Simulating sandbox checkout redirect.");
      
      // Simulate webhook flow by directly adding credits in dev
      const mockPaymentId = `mock_ch_${Math.random().toString(36).substring(2, 15)}`;
      
      await prisma.$transaction(async (tx) => {
        await tx.userCredit.upsert({
          where: { userId },
          create: { userId, balance: pkg.credits },
          update: { balance: { increment: pkg.credits } }
        });

        await tx.creditTransaction.create({
          data: {
            userId,
            packageName: pkg.name,
            creditsAdded: pkg.credits,
            paymentAmount: pkg.price,
            razorpayPaymentId: mockPaymentId,
            status: "succeeded"
          }
        });
      });

      return res.json({
        mock: true,
        url: `${frontendOrigin}/dashboard?mock_success=true&package=${packageKey}`
      });
    }

    // Amount is in INR. Razorpay expects amount in paise (1 INR = 100 paise)
    const amountInPaise = Math.round(pkg.price * 100);

    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: "INR",
      receipt: `receipt_${userId.slice(0, 10)}_${Date.now()}`,
      notes: {
        userId,
        packageKey,
      },
    });

    res.json({
      keyId: env.RAZORPAY_KEY_ID,
      amount: order.amount,
      currency: order.currency,
      orderId: order.id,
      productName: pkg.name,
      productDescription: `Get ${pkg.credits} mock interview credits`,
    });
  } catch (err) {
    next(err);
  }
}

export async function handleRazorpayWebhook(req: Request, res: Response, next: NextFunction) {
  try {
    const sig = req.headers["x-razorpay-signature"];

    if (!razorpay || !env.RAZORPAY_WEBHOOK_SECRET) {
      return res.status(400).json({ message: "Razorpay or Webhook secret is not configured" });
    }

    if (!sig) {
      return res.status(400).json({ message: "Missing Razorpay Signature" });
    }

    // Verify webhook signature using crypto
    const expectedSignature = crypto
      .createHmac("sha256", env.RAZORPAY_WEBHOOK_SECRET)
      .update(req.body)
      .digest("hex");

    if (expectedSignature !== sig) {
      console.error("Razorpay webhook signature verification failed");
      return res.status(400).send("Webhook Error: Signature verification failed");
    }

    // Parse the webhook body since it was parsed as a raw buffer
    const event = JSON.parse(req.body.toString());

    if (event.event === "order.paid") {
      const order = event.payload.order.entity;
      const payment = event.payload.payment.entity;
      
      const userId = order.notes?.userId;
      const packageKey = order.notes?.packageKey;

      if (userId && packageKey && PACKAGES[packageKey]) {
        const pkg = PACKAGES[packageKey];
        const razorpayPaymentId = payment.id as string || order.id;

        try {
          await prisma.$transaction(async (tx) => {
            // Check if transaction already processed to prevent duplicate additions
            const existingTx = await tx.creditTransaction.findUnique({
              where: { razorpayPaymentId }
            });

            if (existingTx) {
              console.log(`Transaction ${razorpayPaymentId} already processed.`);
              return;
            }

            // Update user balance
            await tx.userCredit.upsert({
              where: { userId },
              create: { userId, balance: pkg.credits },
              update: { balance: { increment: pkg.credits } }
            });

            // Log transaction
            await tx.creditTransaction.create({
              data: {
                userId,
                packageName: pkg.name,
                creditsAdded: pkg.credits,
                paymentAmount: pkg.price,
                razorpayPaymentId,
                status: "succeeded"
              }
            });
          });

          console.log(`Successfully credited user ${userId} with ${pkg.credits} credits for package ${packageKey}`);
        } catch (dbErr) {
          console.error("Database transaction error in Razorpay Webhook: ", dbErr);
          return res.status(500).json({ message: "Internal DB transaction error" });
        }
      }
    }

    res.json({ received: true });
  } catch (err) {
    next(err);
  }
}

export async function getTransactions(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;

    const credit = await prisma.userCredit.findUnique({
      where: { userId }
    });

    const transactions = await prisma.creditTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" }
    });

    res.json({
      balance: credit?.balance ?? 0,
      transactions
    });
  } catch (err) {
    next(err);
  }
}

// Development helper to add credits manually
export async function devAddCredits(req: Request, res: Response, next: NextFunction) {
  try {
    if (env.NODE_ENV === "production") {
      return res.status(403).json({ message: "Not allowed in production mode" });
    }

    const userId = req.user!.id;
    const { amount } = req.body;
    const parsedAmount = parseInt(amount, 10);

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ message: "Invalid amount specified" });
    }

    const credit = await prisma.userCredit.upsert({
      where: { userId },
      create: { userId, balance: parsedAmount },
      update: { balance: { increment: parsedAmount } }
    });

    // Also log a mock transaction
    await prisma.creditTransaction.create({
      data: {
        userId,
        packageName: "Dev Adjustment Pack",
        creditsAdded: parsedAmount,
        paymentAmount: 0.00,
        razorpayPaymentId: `dev_adjust_${Date.now()}`,
        status: "succeeded"
      }
    });

    res.json({
      message: `Successfully added ${parsedAmount} credits`,
      balance: credit.balance
    });
  } catch (err) {
    next(err);
  }
}

export async function verifyPayment(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const { razorpayPaymentId, razorpayOrderId, razorpaySignature, packageKey } = req.body;

    if (!packageKey || !PACKAGES[packageKey]) {
      return res.status(400).json({ message: "Invalid package key selected" });
    }

    const pkg = PACKAGES[packageKey];

    // If Razorpay keys are not configured, simulate sandbox success
    if (!razorpay || !env.RAZORPAY_KEY_SECRET) {
      if (env.NODE_ENV === "production") {
        console.error("CRITICAL: Razorpay keys are missing in production environment during verification!");
        return res.status(500).json({ message: "Payment gateway configuration error. Please contact support." });
      }

      console.warn("Razorpay configuration missing during verification. Simulating success.");
      const balance = await prisma.$transaction(async (tx) => {
        const credit = await tx.userCredit.upsert({
          where: { userId },
          create: { userId, balance: pkg.credits },
          update: { balance: { increment: pkg.credits } }
        });

        await tx.creditTransaction.create({
          data: {
            userId,
            packageName: pkg.name,
            creditsAdded: pkg.credits,
            paymentAmount: pkg.price,
            razorpayPaymentId: razorpayPaymentId || `mock_verify_${Date.now()}`,
            status: "succeeded"
          }
        });
        return credit.balance;
      });

      return res.json({
        message: `Successfully added ${pkg.credits} credits (sandbox).`,
        balance
      });
    }

    if (!razorpayPaymentId || !razorpayOrderId || !razorpaySignature) {
      return res.status(400).json({ message: "Missing required payment parameters" });
    }

    // Verify signature using HMAC SHA256
    const expectedSignature = crypto
      .createHmac("sha256", env.RAZORPAY_KEY_SECRET)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest("hex");

    if (expectedSignature !== razorpaySignature) {
      console.error("Razorpay payment signature verification failed");
      return res.status(400).json({ message: "Payment signature verification failed" });
    }

    const balance = await prisma.$transaction(async (tx) => {
      // Check if transaction already processed
      const existingTx = await tx.creditTransaction.findUnique({
        where: { razorpayPaymentId }
      });

      if (existingTx) {
        const currentCredit = await tx.userCredit.findUnique({
          where: { userId }
        });
        return currentCredit?.balance ?? 0;
      }

      // Update user balance
      const credit = await tx.userCredit.upsert({
        where: { userId },
        create: { userId, balance: pkg.credits },
        update: { balance: { increment: pkg.credits } }
      });

      // Log transaction
      await tx.creditTransaction.create({
        data: {
          userId,
          packageName: pkg.name,
          creditsAdded: pkg.credits,
          paymentAmount: pkg.price,
          razorpayPaymentId,
          status: "succeeded"
        }
      });

      return credit.balance;
    });

    console.log(`Successfully verified payment and credited user ${userId} with ${pkg.credits} credits.`);
    res.json({
      message: `Successfully added ${pkg.credits} credits.`,
      balance
    });
  } catch (err) {
    next(err);
  }
}

