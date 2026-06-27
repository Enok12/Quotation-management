import { InviteInvalid } from "./_components/invite-invalid";

export const metadata = { title: "Customer Registration" };

// The bare /customer-form URL has no token, so there is no longer an open
// registration form. Customers must use the one-time link staff send them.
export default function CustomerFormIndexPage() {
  return <InviteInvalid />;
}
