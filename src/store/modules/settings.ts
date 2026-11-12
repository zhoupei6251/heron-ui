import { useStorage } from '@vueuse/core';
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { NavTypeEnum } from '@/enums/NavTypeEnum';
import defaultSettings from '@/settings';
import { useDynamicTitle } from '@/utils/dynamicTitle';

/** 历史默认主色：若依蓝与上一版品牌青，仅用于识别未自定义过主题的老用户 */
const LEGACY_THEME_COLORS = ['#409EFF', '#1B6C80'];

/** 基座历史默认圆角（px），仅用于识别未自定义过圆角的老用户 */
const LEGACY_DEFAULT_RADIUS_BASE = 14;

export const useSettingsStore = defineStore('setting', () => {
  const storageSetting = useStorage<LayoutSetting>('layout-setting', {
    tagsView: defaultSettings.tagsView,
    tagsViewPersist: defaultSettings.tagsViewPersist,
    tagsIcon: defaultSettings.tagsIcon,
    fixedHeader: defaultSettings.fixedHeader,
    sidebarLogo: defaultSettings.sidebarLogo,
    dynamicTitle: defaultSettings.dynamicTitle,
    sideTheme: defaultSettings.sideTheme,
    theme: defaultSettings.theme,
    navType: defaultSettings.navType,
    radiusBase: defaultSettings.radiusBase,
    fullHeightTable: defaultSettings.fullHeightTable
  });
  // 一次性视觉迁移：只跑一次，之后用户在布局设置里的显式选择不会被覆盖
  const VISUAL_MIGRATED = 'heron-side-theme-migrated';
  if (!localStorage.getItem(VISUAL_MIGRATED)) {
    // 仅覆盖仍停留在旧默认值的持久化项，用户自定义值不动
    if (LEGACY_THEME_COLORS.includes(storageSetting.value.theme?.toUpperCase() ?? '')) {
      storageSetting.value.theme = defaultSettings.theme;
    }
    if (storageSetting.value.radiusBase === LEGACY_DEFAULT_RADIUS_BASE) {
      storageSetting.value.radiusBase = defaultSettings.radiusBase;
    }
    if (storageSetting.value.sideTheme === 'theme-dark') {
      storageSetting.value.sideTheme = defaultSettings.sideTheme;
    }
    localStorage.setItem(VISUAL_MIGRATED, '1');
  }
  const title = ref<string>(defaultSettings.title);
  const theme = ref<string>(storageSetting.value.theme);
  const sideTheme = ref<string>(storageSetting.value.sideTheme);
  const showSettings = ref<boolean>(defaultSettings.showSettings);
  const tagsView = ref<boolean>(storageSetting.value.tagsView);
  const tagsViewPersist = ref<boolean>(storageSetting.value.tagsViewPersist);
  const tagsIcon = ref<boolean>(storageSetting.value.tagsIcon);
  const fixedHeader = ref<boolean>(storageSetting.value.fixedHeader);
  const sidebarLogo = ref<boolean>(storageSetting.value.sidebarLogo);
  const dynamicTitle = ref<boolean>(storageSetting.value.dynamicTitle);
  const animationEnable = ref<boolean>(defaultSettings.animationEnable);
  const dark = ref<boolean>(defaultSettings.dark);
  const navType = ref<NavTypeEnum>(storageSetting.value.navType || NavTypeEnum.LEFT);
  const radiusBase = ref<number>(storageSetting.value.radiusBase ?? defaultSettings.radiusBase);
  const fullHeightTable = ref<boolean>(storageSetting.value.fullHeightTable ?? defaultSettings.fullHeightTable);

  const setTitle = (value: string) => {
    title.value = value;
    useDynamicTitle();
  };
  return {
    title,
    theme,
    sideTheme,
    showSettings,
    tagsView,
    tagsViewPersist,
    tagsIcon,
    fixedHeader,
    sidebarLogo,
    dynamicTitle,
    animationEnable,
    dark,
    navType,
    radiusBase,
    fullHeightTable,
    setTitle
  };
});
