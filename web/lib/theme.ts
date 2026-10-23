/**
 * ธีม มืด/สว่าง (เจ้าของเคาะ 23 ต.ค. 2026 · doc/DECISIONS.md)
 *
 * ค่าที่ผู้ใช้เลือก: อัตโนมัติ (ตามเครื่อง · ค่าเริ่มต้น) / สว่าง / มืด — จำไว้ต่อเครื่อง
 * ใน localStorage · ผลลัพธ์ลงที่ `<html data-theme="light|dark">` ซึ่ง CSS อ่าน
 * (`:root[data-theme="light"]` ใน app/globals.css)
 *
 * ⚠️ **ต้องตั้งก่อนหน้าแรกวาด** — ถ้ารอ React hydrate ผู้ใช้ธีมสว่างจะเห็นจอมืด
 *    แวบหนึ่งทุกครั้งที่เปิดแอป · `THEME_BOOT` จึงเป็นสคริปต์ inline ใน <head>
 *    (app/layout.tsx) ไม่ใช่ effect
 */

export type ThemePref = 'auto' | 'light' | 'dark'

export const THEME_KEY = 'kevin-theme'

/**
 * สีแถบระบบของมือถือต่อธีม = `--surface` ของธีมนั้น (มติ 1 ก.ย. 2026: แถบระบบกลืนกับ
 * แถบล่าง) · ⚠️ ต้องตรงกับ `--surface` ทั้งสองชุดใน globals.css และ `themeColor`
 * ใน app/layout.tsx
 */
export const THEME_COLOR = { dark: '#1B1630', light: '#FFFFFF' } as const

/**
 * สคริปต์ที่รันก่อนวาด · เขียนเป็นสตริงเพราะต้องอยู่ใน <head> ตรง ๆ ไม่ผ่าน bundle
 * ตรรกะเดียวกับ `applyTheme()` ข้างล่าง — **แก้ที่หนึ่งต้องแก้อีกที่**
 * ฟังการเปลี่ยนโหมดของเครื่องด้วย จะได้สลับเองตอนเครื่องเปลี่ยนเป็นโหมดกลางคืน
 */
export const THEME_BOOT = `(function(){
  var K=${JSON.stringify(THEME_KEY)}, C=${JSON.stringify(THEME_COLOR)};
  var mq=window.matchMedia('(prefers-color-scheme: light)');
  function apply(){
    var p='auto'; try{p=localStorage.getItem(K)||'auto'}catch(e){}
    var t=p==='light'||p==='dark'?p:(mq.matches?'light':'dark');
    document.documentElement.dataset.theme=t;
    var m=document.querySelector('meta[name="theme-color"]'); if(m) m.setAttribute('content',C[t]);
  }
  apply();
  if(mq.addEventListener) mq.addEventListener('change',apply);
  window.__kevinApplyTheme=apply;
})();`

export function readThemePref(): ThemePref {
  let raw: string | null = null
  try { raw = window.localStorage.getItem(THEME_KEY) } catch { raw = null }
  return raw === 'light' || raw === 'dark' ? raw : 'auto'
}

/** จำค่าที่เลือกแล้วสลับทันที · ใช้ตัวเดียวกับสคริปต์ตอนบูต */
export function setThemePref(pref: ThemePref) {
  try {
    if (pref === 'auto') window.localStorage.removeItem(THEME_KEY)
    else window.localStorage.setItem(THEME_KEY, pref)
  } catch { /* ไม่จำก็สลับได้ในรอบนี้ */ }

  const apply = (window as unknown as { __kevinApplyTheme?: () => void }).__kevinApplyTheme
  if (apply) { apply(); return }
  // สคริปต์บูตไม่ได้รัน (ไม่ควรเกิด) — สลับเองแบบเดียวกัน
  const t = pref === 'auto'
    ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
    : pref
  document.documentElement.dataset.theme = t
}
