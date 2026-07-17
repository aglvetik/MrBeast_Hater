import type { Locale } from "../../domain/policy/types.js";

type MessageKey =
  | "setup.title"
  | "status.title"
  | "status.disabled"
  | "status.enabled"
  | "diagnose.title"
  | "help.title"
  | "help.body"
  | "data.delete.confirm"
  | "data.delete.done"
  | "action.remove_timeout"
  | "action.false_positive"
  | "action.open_settings"
  | "action.set_delete_only"
  | "setup.expired"
  | "setup.busy"
  | "setup.saved"
  | "setup.cancelled"
  | "generic.no_permission"
  | "generic.guild_only"
  | "generic.success"
  | "generic.not_found";

const catalog: Record<Locale, Record<MessageKey, string>> = {
  en: {
    "setup.title": "PingGuard setup",
    "status.title": "PingGuard status",
    "status.disabled": "Protection is currently disabled.",
    "status.enabled": "Protection is enabled.",
    "diagnose.title": "PingGuard diagnostics",
    "help.title": "PingGuard help",
    "help.body": "Use /guard setup first, then configure roles, channels, and punishments.",
    "data.delete.confirm": "Confirm full guild data deletion for PingGuard.",
    "data.delete.done": "Guild data deleted.",
    "action.remove_timeout": "Remove timeout",
    "action.false_positive": "Mark false positive",
    "action.open_settings": "Open settings",
    "action.set_delete_only": "Set channel to DELETE_ONLY",
    "setup.expired": "This setup session expired. Run /guard setup again.",
    "setup.busy": "Another setup session is already active for this guild.",
    "setup.saved": "PingGuard setup completed.",
    "setup.cancelled": "Setup cancelled.",
    "generic.no_permission": "You do not have permission to do that.",
    "generic.guild_only": "This command can only be used in a server.",
    "generic.success": "Done.",
    "generic.not_found": "Nothing matching that request was found."
  },
  ru: {
    "setup.title": "Настройка PingGuard",
    "status.title": "Статус PingGuard",
    "status.disabled": "Защита сейчас отключена.",
    "status.enabled": "Защита включена.",
    "diagnose.title": "Диагностика PingGuard",
    "help.title": "Помощь PingGuard",
    "help.body": "Сначала выполните /guard setup, затем настройте роли, каналы и наказания.",
    "data.delete.confirm": "Подтвердите полное удаление данных PingGuard для этого сервера.",
    "data.delete.done": "Данные сервера удалены.",
    "action.remove_timeout": "Снять таймаут",
    "action.false_positive": "Отметить ложное срабатывание",
    "action.open_settings": "Открыть настройки",
    "action.set_delete_only": "Переключить канал в DELETE_ONLY",
    "setup.expired": "Сессия настройки истекла. Запустите /guard setup снова.",
    "setup.busy": "Для этого сервера уже открыта другая сессия настройки.",
    "setup.saved": "Настройка PingGuard завершена.",
    "setup.cancelled": "Настройка отменена.",
    "generic.no_permission": "У вас нет прав для этого действия.",
    "generic.guild_only": "Эту команду можно использовать только на сервере.",
    "generic.success": "Готово.",
    "generic.not_found": "Подходящие данные не найдены."
  }
};

export function t(locale: Locale, key: MessageKey): string {
  return catalog[locale][key] ?? catalog.en[key];
}
