import { ReticleDev } from './reticle-dev';
import "./globals.css";

export const metadata = {
  title: "Finance Manager",
  description: "Manage company finances with ease",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{process.env.NODE_ENV === 'development' ? <ReticleDev /> : null}{children}</body>
    </html>
  );
}