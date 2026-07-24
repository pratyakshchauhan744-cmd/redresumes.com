import { Resend } from "resend";

const resend = new Resend("re_7yzwRKNz_LbFkNLCUq6A3uU6QueaQpASA");

async function testSend() {
  const res = await resend.emails.send({
    from: "onboarding@resend.dev",
    to: "pratyakshchahan744@gmail.com",
    subject: "Test email to Resend owner",
    html: "<p>Success! Onboarding test email works!</p>",
  });
  console.log("SUCCESS RESULT:", res);
}

testSend().catch(console.error);
