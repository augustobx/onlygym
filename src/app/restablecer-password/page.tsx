import ResetPasswordForm from "./ResetPasswordForm";

export default async function RestablecerPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const params = await searchParams;
  return <ResetPasswordForm token={params.token || ""} />;
}
