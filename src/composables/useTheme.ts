import { ref, computed } from "vue";
import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";

export type ThemeMode = "system" | "light" | "dark";

const STORAGE_KEY = "laf_theme_preference";

const currentMode = ref<ThemeMode>(
  (localStorage.getItem(STORAGE_KEY) as ThemeMode) || "light"
);

const isSystemDark = ref(
  typeof window !== "undefined"
    ? window.matchMedia("(prefers-color-scheme: dark)").matches
    : false
);

let initialized = false;

export function useTheme() {
  const isDark = computed(() => {
    if (currentMode.value === "dark") return true;
    if (currentMode.value === "light") return false;
    return isSystemDark.value;
  });

  const applyTheme = (mode: ThemeMode) => {
    currentMode.value = mode;
    localStorage.setItem(STORAGE_KEY, mode);

    const dark = mode === "dark" ? true : mode === "light" ? false : isSystemDark.value;

    const root = document.documentElement;
    const body = document.body;

    if (dark) {
      root.classList.add("ion-palette-dark", "dark");
      root.classList.remove("ion-palette-light", "light");
      body.classList.add("ion-palette-dark", "dark");
      body.classList.remove("ion-palette-light", "light");
    } else {
      root.classList.remove("ion-palette-dark", "dark");
      root.classList.add("ion-palette-light", "light");
      body.classList.remove("ion-palette-dark", "dark");
      body.classList.add("ion-palette-light", "light");
    }

    // Safely update Capacitor StatusBar on native devices
    if (Capacitor.isPluginAvailable("StatusBar")) {
      try {
        StatusBar.setStyle({
          style: dark ? Style.Dark : Style.Light
        }).catch(() => {});
        StatusBar.setBackgroundColor({
          color: dark ? "#000000" : "#F5F5F7"
        }).catch(() => {});
      } catch {
        // Ignore in browser
      }
    }
  };

  const initTheme = () => {
    if (initialized || typeof window === "undefined") return;
    initialized = true;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    isSystemDark.value = mediaQuery.matches;

    // Listen for system theme changes
    mediaQuery.addEventListener("change", (e) => {
      isSystemDark.value = e.matches;
      if (currentMode.value === "system") {
        applyTheme("system");
      }
    });

    // Apply initial stored or system theme
    applyTheme(currentMode.value);
  };

  return {
    themeMode: computed(() => currentMode.value),
    themePreference: computed(() => currentMode.value),
    isDark,
    setTheme: applyTheme,
    initTheme
  };
}
