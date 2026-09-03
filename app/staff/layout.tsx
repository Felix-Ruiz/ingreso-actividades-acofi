import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Staff ACOFI",
  description: "Panel administrativo y escáner",
  // MAGIA: Esta línea sobreescribe tu manifest.ts principal SOLAMENTE cuando entran a /staff
  manifest: "/manifest-staff.json", 
};

export default function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}