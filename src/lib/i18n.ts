import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

const resources = {
  fr: {
    translation: {
      common: {
        search: 'Rechercher', save: 'Enregistrer', cancel: 'Annuler', delete: 'Supprimer',
        edit: 'Modifier', add: 'Ajouter', close: 'Fermer', loading: 'Chargement…',
        export: 'Exporter', import: 'Importer', date: 'Date', quantity: 'Quantité',
        product: 'Produit', total: 'Total', actions: 'Actions', filter: 'Filtrer',
        all: 'Tous', yes: 'Oui', no: 'Non', confirm: 'Confirmer',
      },
      nav: {
        dashboard: 'Tableau de bord', insights: 'Assistant IA', achats: 'Achats MP',
        fiches: 'Fiches Techniques', bons: 'Bons de Transfert', stock: 'Stock Tampon',
        pertes: 'Pertes', production: 'Production Labo', inventaire: 'Inventaire',
        cloture: 'Clôture & Salle', degustations: 'Dégustations', admin: 'Administration',
        audit: "Journal d'activité", logout: 'Déconnexion', subtitle: 'Laboratoire & Boutique',
      },
      lang: { fr: 'Français', en: 'English', ar: 'العربية', label: 'Langue' },
    },
  },
  en: {
    translation: {
      common: {
        search: 'Search', save: 'Save', cancel: 'Cancel', delete: 'Delete',
        edit: 'Edit', add: 'Add', close: 'Close', loading: 'Loading…',
        export: 'Export', import: 'Import', date: 'Date', quantity: 'Quantity',
        product: 'Product', total: 'Total', actions: 'Actions', filter: 'Filter',
        all: 'All', yes: 'Yes', no: 'No', confirm: 'Confirm',
      },
      nav: {
        dashboard: 'Dashboard', insights: 'AI Assistant', achats: 'Raw Materials',
        fiches: 'Recipe Sheets', bons: 'Transfer Slips', stock: 'Buffer Stock',
        pertes: 'Losses', production: 'Lab Production', inventaire: 'Inventory',
        cloture: 'Daily Closing', degustations: 'Tastings', admin: 'Administration',
        audit: 'Activity Log', logout: 'Logout', subtitle: 'Laboratory & Boutique',
      },
      lang: { fr: 'Français', en: 'English', ar: 'العربية', label: 'Language' },
    },
  },
  ar: {
    translation: {
      common: {
        search: 'بحث', save: 'حفظ', cancel: 'إلغاء', delete: 'حذف',
        edit: 'تعديل', add: 'إضافة', close: 'إغلاق', loading: 'جارٍ التحميل…',
        export: 'تصدير', import: 'استيراد', date: 'التاريخ', quantity: 'الكمية',
        product: 'المنتج', total: 'الإجمالي', actions: 'إجراءات', filter: 'تصفية',
        all: 'الكل', yes: 'نعم', no: 'لا', confirm: 'تأكيد',
      },
      nav: {
        dashboard: 'لوحة القيادة', insights: 'المساعد الذكي', achats: 'المواد الخام',
        fiches: 'بطاقات الوصفات', bons: 'سندات التحويل', stock: 'المخزون الاحتياطي',
        pertes: 'الخسائر', production: 'إنتاج المختبر', inventaire: 'الجرد',
        cloture: 'الإقفال اليومي', degustations: 'التذوق', admin: 'الإدارة',
        audit: 'سجل النشاط', logout: 'تسجيل الخروج', subtitle: 'المختبر والمحل',
      },
      lang: { fr: 'Français', en: 'English', ar: 'العربية', label: 'اللغة' },
    },
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'fr',
    supportedLngs: ['fr', 'en', 'ar'],
    interpolation: { escapeValue: false },
    detection: { order: ['localStorage', 'navigator'], caches: ['localStorage'] },
  });

// RTL handling for Arabic
const applyDir = (lng: string) => {
  document.documentElement.dir = lng === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.lang = lng;
};
applyDir(i18n.language);
i18n.on('languageChanged', applyDir);

export default i18n;
