import type { NextConfig } from "next";

/*
  M4 — تحويل مسارات masjid-idara إلى المنصة الموحّدة (halaqat-tahfeez).
  temporary (permanent: false) عمداً: تحويل 302/307 لا يُخزَّن بالمتصفحات
  ولا يُثبَّت بمحركات البحث، فيمكن التراجع بإزالة القائمة. الكود القديم
  كله يبقى كما هو — لا حذف ولا تعطيل.
*/

const PLATFORM = "https://halaqat-tahfeez.vercel.app";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // الصفحة الرئيسية → لوحة المطوّر بالمنصة الجديدة
      { source: "/", destination: "https://mos-dev-console.vercel.app/dev", permanent: false },
      // دخول مدير الجامع — المسار نفسه بالمنصة الجديدة
      { source: "/mosque-login", destination: `${PLATFORM}/mosque-login`, permanent: false },
      // لوحات الجوامع (المشرف العام ومدراء الجوامع)
      // معرّفات الجوامع تغيّرت عند النقل (merge_id_map): 9→2، 16→3
      { source: "/mosque/9/:path*", destination: `${PLATFORM}/mosque/2/:path*`, permanent: false },
      { source: "/mosque/16/:path*", destination: `${PLATFORM}/mosque/3/:path*`, permanent: false },
      { source: "/j/9/:path*", destination: `${PLATFORM}/j/2/:path*`, permanent: false },
      { source: "/j/16/:path*", destination: `${PLATFORM}/j/3/:path*`, permanent: false },
      { source: "/mosque/:path*", destination: `${PLATFORM}/mosque/:path*`, permanent: false },
      // روابط الدعوة العامة للتسجيل (رمز الدعوة بالمسار نفسه)
      { source: "/j/:path*", destination: `${PLATFORM}/j/:path*`, permanent: false },
    ];
  },
};

export default nextConfig;
