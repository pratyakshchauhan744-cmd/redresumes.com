"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { signSessionToken, setSessionCookie, clearSessionCookie } from "@/lib/auth";
import bcrypt from "bcryptjs";

const LoginSchema = z.object({
  email: z.string().email("Please provide a valid administrative email address"),
  password: z.string().min(6, "Password must contain at least 6 characters"),
});

export async function loginStaff(prevState: any, formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  // 1. Validate form fields
  const validated = LoginSchema.safeParse({ email, password });
  if (!validated.success) {
    return {
      success: false,
      error: validated.error.errors[0].message,
    };
  }

  try {
    // 2. Fetch user from database
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return {
        success: false,
        error: "Invalid email address or credentials",
      };
    }

    // 3. Verify user is internal staff
    const allowedStaffRoles = ["admin", "manager", "support"];
    if (!allowedStaffRoles.includes(user.role)) {
      return {
        success: false,
        error: "Access denied: Account is not configured with staff privileges",
      };
    }

    // 4. Verify password hash
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return {
        success: false,
        error: "Invalid password or credentials",
      };
    }

    // 5. Generate secure JWT session token
    const token = await signSessionToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    // 6. Save in secure HttpOnly cookie
    await setSessionCookie(token);

    return {
      success: true,
      error: null,
    };
  } catch (error) {
    console.error("Staff login action failure:", error);
    return {
      success: false,
      error: `Internal Error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export async function logoutStaff() {
  await clearSessionCookie();
}
