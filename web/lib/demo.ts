/**
 * บัญชีตัวอย่าง (demo) — ปุ่มใต้ฟอร์มหน้า login ให้คนที่ยังไม่มีบัญชีเข้าไปลอง
 * (เจ้าของเคาะ 21 ต.ค. 2026 · doc/DECISIONS.md)
 *
 * - **บัญชีเดียวใช้ร่วมกัน** · กดเข้าทุกครั้ง = ล้างแล้วใส่ข้อมูลตัวอย่างใหม่
 *   (`reset_demo()` ใน supabase/migrations/20261021120000_demo_account.sql)
 * - ปิดแอปหรือเปิดแท็บใหม่ = หลุดออก (`components/DemoGuard.tsx`)
 * - ผู้ช่วย: แชต 3 + โทร 3 ต่อเครื่องต่อวัน บวกเพดานรวมทั้ง demo
 *
 * ⚠️ **ตัดสินว่าเป็น demo จากอีเมลใน JWT ไม่ใช่จาก cookie** — cookie `kevin_demo`
 *    มีไว้ให้หน้าจอรู้เท่านั้น ลบทิ้งได้จากคอนโซล · ถ้าเอาไปใช้คุมโควตา
 *    ลบ cookie ตัวเดียวก็ใช้ Gemini ได้ไม่จำกัด
 */
// ⚠️ ไฟล์นี้ต้องมีแต่ค่าคงที่ — หน้าจอฝั่งเบราว์เซอร์ import ได้ · ตัวที่แตะ cookie/DB อยู่ใน lib/demoServer.ts

/** ให้หน้าจอรู้ว่าแท็บนี้อยู่ในบัญชี demo · อ่านจากฝั่งเบราว์เซอร์ได้ ไม่ใช่ httpOnly */
export const DEMO_COOKIE = 'kevin_demo'

/** ตัวนับโควตาต่อเครื่อง · httpOnly · อยู่ข้ามการเข้า demo หลายรอบ */
export const DEVICE_COOKIE = 'kevin_demo_device'

/** ธงใน sessionStorage ว่า "แท็บนี้เป็นคนกดเข้า demo เอง" — แท็บใหม่ไม่มีธงนี้ */
export const DEMO_TAB_KEY = 'kevin-demo-tab'

/**
 * เพดานผู้ช่วยของ demo
 *
 * `perDevice` = เจ้าของเคาะ · `global` = กันคนล้าง cookie วนเอาสิทธิ์ใหม่
 * (ล้างได้จริง เจ้าของรู้และยอมรับ) · โทรแพงกว่าแชตมาก เพดานรวมจึงต่ำกว่า
 */
export const DEMO_LIMITS = {
  chat: { perDevice: 3, global: 150 },
  voice: { perDevice: 3, global: 30 },
} as const

/** สายของ demo ยาวได้เท่านี้ · บัญชีจริงได้ 30 นาที (app/api/voice/token) */
export const DEMO_CALL_MS = 5 * 60_000
