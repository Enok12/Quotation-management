export const metadata = {
  title: "Confirm your order",
  description: "Confirm your delivery details",
  // A private, per-customer link — keep it out of search results.
  robots: { index: false, follow: false },
};

export default function CodConfirmLayout({ children }: { children: React.ReactNode }) {
  return children;
}
