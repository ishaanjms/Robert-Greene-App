import type { Metadata } from 'next';
import { Merriweather, Open_Sans } from 'next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { SidebarProvider } from '@/components/ui/sidebar';
import AppSidebar from '@/components/layout/AppSidebar';
import { SidebarInset } from '@/components/ui/sidebar';


const merriweather = Merriweather({
  subsets: ['latin'],
  weight: ['700'], // For Merriweather Bold
  variable: '--font-merriweather',
});

const openSans = Open_Sans({
  subsets: ['latin'],
  weight: ['400'], // For Open Sans Regular
  variable: '--font-open-sans',
});

export const metadata: Metadata = {
  title: "Greene's Counsel",
  description: "Virtual mentorship with Robert Greene by Firebase Studio",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">{/* Force dark theme as per design */}
      <body className={`${merriweather.variable} ${openSans.variable} font-sans antialiased`}>
        <SidebarProvider defaultOpen // Default to open on desktop, mobile will be closed by Sheet
        > 
          <AppSidebar />
          <SidebarInset>
            {children}
          </SidebarInset>
        </SidebarProvider>
        <Toaster />
      </body>
    </html>
  );
}
