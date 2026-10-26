import './globals.css';
import { DemoNav } from './_components/demo-nav';

export const metadata = { title: 'Virtualization from RSC' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <DemoNav />
        {children}
      </body>
    </html>
  );
}
