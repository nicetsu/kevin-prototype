/**
 * สร้างบัญชีตัวอย่าง (demo) หนึ่งครั้ง · เจ้าของรันเอง
 *
 *   node --use-system-ca scripts/create-demo-account.mjs <อีเมล> <รหัสเชิญ>
 *
 * - สุ่มรหัสผ่านยาว ๆ แล้วเขียนลง .env.local (DEMO_EMAIL / DEMO_PASSWORD)
 *   **รหัสไม่ถูกพิมพ์ออกจอ** · ต้องเอาสองค่านี้ไปใส่ Vercel env ด้วย
 * - สมัครผ่าน Supabase Auth ตามปกติ — ด่านรหัสเชิญใน trigger ทำงานเหมือนทุกบัญชี
 * - อีเมลต้องเปิดอ่านได้ เพราะต้องกดลิงก์ยืนยัน (ใช้ Gmail แบบ +demo ได้)
 *
 * หลังยืนยันอีเมลแล้ว ต้องลงทะเบียนบัญชีนี้ใน `public.demo_account` ด้วย
 * ไม่งั้น `reset_demo()` ไม่รู้ว่าบัญชีไหนคือ demo
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const [email, invite] = process.argv.slice(2)
if (!email || !invite) {
  console.error('ใช้: node --use-system-ca scripts/create-demo-account.mjs <อีเมล> <รหัสเชิญ>')
  process.exit(1)
}

const ENV = new URL('../.env.local', import.meta.url)
let env = readFileSync(ENV, 'utf8')
const get = (k) => env.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1]?.trim()
const put = (k, v) => {
  env = new RegExp(`^${k}=`, 'm').test(env)
    ? env.replace(new RegExp(`^${k}=.*$`, 'm'), `${k}=${v}`)
    : `${env.replace(/\n?$/, '\n')}${k}=${v}\n`
}

if (get('DEMO_PASSWORD')) {
  console.error('.env.local มี DEMO_PASSWORD อยู่แล้ว · ลบบรรทัดนั้นก่อนถ้าจะสร้างใหม่จริง ๆ')
  process.exit(1)
}

const password = randomBytes(24).toString('base64url')
const supabase = createClient(get('NEXT_PUBLIC_SUPABASE_URL'), get('NEXT_PUBLIC_SUPABASE_ANON_KEY'))
const { data, error } = await supabase.auth.signUp({
  email,
  password,
  options: { data: { invite_code: invite } },
})
if (error) {
  console.error('สมัครไม่สำเร็จ:', error.message)
  process.exit(1)
}

put('DEMO_EMAIL', email)
put('DEMO_PASSWORD', password)
writeFileSync(ENV, env)
console.log(`สมัครแล้ว · user id ${data.user?.id}`)
console.log(`เขียน DEMO_EMAIL / DEMO_PASSWORD ลง .env.local แล้ว (ไม่แสดงรหัส)`)
console.log(`ต่อไป: เปิดเมลที่ ${email} แล้วกดลิงก์ยืนยัน`)
