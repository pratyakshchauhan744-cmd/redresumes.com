import { Resend } from "resend";

const resend = new Resend("re_7yzwRKNz_LbFkNLCUq6A3uU6QueaQpASA");

async function checkEmailStatus() {
  const result = await resend.emails.get("415d8920-fb93-4702-b4b7-f14bb0a1a835");
  console.log("RESEND EMAIL STATUS:", result);
}

checkEmailStatus().catch(console.error);
