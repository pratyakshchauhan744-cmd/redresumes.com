import { Resend } from "resend";

const resend = new Resend("re_7yzwRKNz_LbFkNLCUq6A3uU6QueaQpASA");

async function testSend() {
  console.log("Testing Resend send...");
  const res1 = await resend.emails.send({
    from: "onboarding@resend.dev",
    to: "pratyakshchauhan744@gmail.com",
    subject: "Test email",
    html: "<p>Test</p>",
  });
  console.log("Result with onboarding@resend.dev:", res1);

  const res2 = await resend.emails.send({
    from: "pratyakshchauhan744@gmail.com",
    to: "pratyakshchauhan744@gmail.com",
    subject: "Test email 2",
    html: "<p>Test 2</p>",
  });
  console.log("Result with gmail.com from address:", res2);
}

testSend().catch(console.error);
