/*
  سجل مزايا النظام — المصدر الوحيد للحقيقة. إضافة ميزة جديدة لاحقاً =
  إضافة سطر واحد هنا (+ صفحاتها)، وستظهر لكل الجوامع بإعداداتها تلقائياً.
  "ready" = متاحة الآن للتفعيل/التعطيل لكل جامع، "soon" = قادمة وتظهر
  كبطاقة "قريباً" معطّلة لا يمكن تفعيلها.
*/

export type FeatureStatus = "ready" | "soon";

export type Feature = {
  key: string;
  nameAr: string;
  descriptionAr: string;
  defaultEnabled: boolean;
  status: FeatureStatus;
};

export const FEATURES: readonly Feature[] = [
  {
    key: "halaqat",
    nameAr: "الحلقات",
    descriptionAr: "ربط حلقات الجامع بمعلّميها عبر رمز الدعوة، ومتابعة طلاب كل حلقة.",
    defaultEnabled: true,
    status: "ready",
  },
  {
    key: "registration",
    nameAr: "التسجيل العام",
    descriptionAr: "رابط عام يستقبل رغبات الطلاب الجدد، وتوزّعهم أنت على الحلقات.",
    defaultEnabled: true,
    status: "ready",
  },
  {
    key: "stats",
    nameAr: "الإحصائيات",
    descriptionAr: "لوحة أرقام حية لكل حلقة وللجامع كله، من نظام المعلّم مباشرة.",
    defaultEnabled: true,
    status: "ready",
  },
  {
    key: "brain",
    nameAr: "الدماغ",
    descriptionAr: "ملاحظات الجامع المترابطة: وصلات [[مزدوجة]]، وسوم، وخريطة معرفة.",
    defaultEnabled: true,
    status: "ready",
  },
  {
    key: "families",
    nameAr: "الأسر",
    descriptionAr: "تنظيم أسر الجامع ومتابعة أفرادها من الطلاب وأولياء الأمور.",
    defaultEnabled: false,
    status: "ready",
  },
  {
    key: "committees",
    nameAr: "اللجان",
    descriptionAr: "لجان الجامع وأعضاؤها ومهامها بلوحة متابعة بسيطة.",
    defaultEnabled: false,
    status: "ready",
  },
  {
    key: "weekly_evaluation",
    nameAr: "التقييم الأسبوعي",
    descriptionAr: "تقييم أسبوعي للطلاب والأسر بمعايير يحددها الجامع، مع ترتيب النتائج.",
    defaultEnabled: false,
    status: "ready",
  },
  {
    key: "badges",
    nameAr: "الأوسمة",
    descriptionAr: "أوسمة إنجاز وتحفيز للطلاب.",
    defaultEnabled: false,
    status: "soon",
  },
  {
    key: "weekly_schedule",
    nameAr: "الجدول الأسبوعي",
    descriptionAr: "جدول أسبوعي لحلقات الجامع وأوقاتها.",
    defaultEnabled: false,
    status: "soon",
  },
  {
    key: "reports",
    nameAr: "التقارير",
    descriptionAr: "تقارير دورية قابلة للتصدير.",
    defaultEnabled: false,
    status: "soon",
  },
  {
    key: "agent",
    nameAr: "المساعد الذكي",
    descriptionAr: "مساعد ذكي يجيب عن بيانات الجامع وملاحظاته.",
    defaultEnabled: false,
    status: "soon",
  },
];

/** ميزة من السجل بمفتاحها، أو undefined إن كان المفتاح غير معروف */
export function getFeature(key: string): Feature | undefined {
  return FEATURES.find((feature) => feature.key === key);
}

/** حوّل حالات المزايا إلى خريطة {مفتاح: مفعّل؟} — "قريباً" دائماً غير مفعّلة */
export function effectiveFeatures(
  states: readonly { key: string; status: FeatureStatus; enabled: boolean }[],
): Record<string, boolean> {
  return Object.fromEntries(states.map((state) => [state.key, state.enabled && state.status === "ready"]));
}
