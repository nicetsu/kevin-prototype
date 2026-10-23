import type { Metadata, Viewport } from 'next'
import { Inter, Noto_Sans_Thai } from 'next/font/google'
import Nav from '@/components/Nav'
import QuickAddMount from '@/components/QuickAddMount'
import CallProvider from '@/components/CallProvider'
import DemoGuard from '@/components/DemoGuard'
import { THEME_BOOT, THEME_COLOR } from '@/lib/theme'
import './globals.css'

// ทรงตัวอักษรคือครึ่งหนึ่งของบุคลิกสไตล์นี้ (doc/TRAPS.md) — ต้องโหลดจริง
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const notoThai = Noto_Sans_Thai({
  subsets: ['thai'],
  variable: '--font-noto-thai',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'KeviN',
  description: 'ผู้ช่วยส่วนตัว',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'KeviN' },
  icons: { icon: '/icon-192.png', apple: '/apple-touch-icon.png' },
}

/*
 * ⚠️ **สามค่านี้ต้องขยับตามพาเลตเสมอ** — `themeColor` ที่นี่ กับ
 *    `theme_color` / `background_color` ใน `public/manifest.json`
 *
 *    เคยค้างที่ `#0A0912` ซึ่งเป็นสีพื้น**ก่อน**อุ่นพาเลตเป็น `#120E22` (1 ก.ย. 2026)
 *    ผลคือแถบระบบของ Android เป็นดำสนิทตัดกับแอปอย่างเห็นได้ชัด
 *    แต่ไม่มีอะไรใน repo ฟ้อง เพราะมันอยู่คนละไฟล์กับ `globals.css`
 *
 * `themeColor` ใช้**สีแถบล่าง** (`--surface`) เพื่อให้พื้นรอบขีดปัดของ Android
 * กลืนกับแถบเมนูเป็นเนื้อเดียว — เจ้าของเลือกแบบนี้ (1 ก.ย. 2026)
 *
 * ⚠️ เคยเปลี่ยนเป็นสีพื้นแล้วเปลี่ยนกลับ · **อย่าเปลี่ยนโดยไม่ถาม** —
 *    ทุกครั้งที่แก้ค่านี้ เจ้าของต้องถอนแล้วติดตั้ง PWA ใหม่ถึงจะเห็นผล
 */
export const viewport: Viewport = {
  // ค่าตอนวาดครั้งแรก · สคริปต์ธีมเปลี่ยนเป็นสีของธีมที่ใช้อยู่ทันที (lib/theme.ts)
  // ⚠️ ธีมสว่างมีคู่ของตัวเองใน THEME_COLOR — แก้สีแถบระบบต้องแก้ทั้งสองชุด
  themeColor: THEME_COLOR.dark,
  width: 'device-width',
  initialScale: 1,
  /*
   * ⚠️ `cover` ทำให้แอปวาดไปถึงใต้แถบของระบบ — **นั่นคือสิ่งเดียวที่ทำให้
   *    พื้นหลังของแถบนำทางเป็นสีของเรา** ไม่ใช่สีที่ระบบเลือกให้
   *
   *    แลกมาด้วยการที่ต้องเผื่อ `env(safe-area-inset-*)` เองทุกที่ —
   *    `.wrap` เผื่อด้านบน · `.nav` กับ `.fab` เผื่อด้านล่างอยู่แล้ว
   */
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    // suppressHydrationWarning: `data-theme` ถูกตั้งโดยสคริปต์ก่อน React มาถึง (lib/theme.ts)
    <html lang="th" className={`${inter.variable} ${notoThai.variable}`} suppressHydrationWarning>
      <head>
        {/* ต้องรันก่อนวาด ไม่งั้นธีมสว่างเห็นจอมืดแวบหนึ่งทุกครั้งที่เปิดแอป */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body>
        {/*
          สายเสียงอยู่ระดับนี้ ไม่ใช่ในหน้า KeviN — ถ้าเก็บไว้ในหน้า พอสลับไปดู
          ปฏิทินกลางสาย คอมโพเนนต์จะถูก unmount แล้วสายตายทันที
        */}
        <CallProvider>
          {/* บัญชีตัวอย่าง: แถบบอก + เตะออกเมื่อเปิดแอปใหม่ (components/DemoGuard.tsx) */}
          <DemoGuard />
          {children}
          {/*
            ⚠️ **แถบล่างต้องอยู่หลัง `children` ใน DOM** (เจ้าของทัก 2 ก.ย. 2026)
               `z-index: 20` คุมได้ในสภาวะปกติ แต่ระหว่าง view transition แถบถูกยก
               ไปเป็น layer ของตัวเอง (มันมี `view-transition-name`) แล้วลำดับการวาด
               ใช้ tree order ไม่ใช่ z-index · อยู่ก่อน `children` เมื่อไหร่ เนื้อหาที่
               กำลังเลื่อนเข้ามาจะวาดทับแถบ เห็นเป็นข้อความทะลุออกมาหน้าแถบ
          */}
          <Nav />
          <QuickAddMount />
        </CallProvider>
      </body>
    </html>
  )
}
