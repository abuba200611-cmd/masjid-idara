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
      { source: "/", destination: `${PLATFORM}/dev`, permanent: false },
      // دخول مدير الجامع — المسار نفسه بالمنصة الجديدة
      { source: "/mosque-login", destination: `${PLATFORM}/mosque-login`, permanent: false },
      // لوحات الجوامع (المشرف العام ومدراء الجوامع)
      { source: "/mosque/:path*", destination: `${PLATFORM}/mosque/:path*`, permanent: false },
      // روابط الدعوة العامة للتسجيل (رمز الدعوة بالمسار نفسه)
      { source: "/j/:path*", destination: `${PLATFORM}/j/:path*`, permanent: false },
    ];
  },
};

export default nextConfig;
