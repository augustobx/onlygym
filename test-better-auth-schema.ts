import { auth } from "./src/lib/auth";

async function test() {
  const headers = new Headers();
  try {
    const res = await auth.api.signUpEmail({
      body: {
        name: "Test Admin",
        email: "testadmin@test.com",
        username: "testadmin",
        password: "admin123"
      } as any,
      headers
    });
    console.log("SUCCESS:", JSON.stringify(res, null, 2));
  } catch (e: any) {
    console.log("ERROR:", e);
  }
}

test().catch(console.error);
