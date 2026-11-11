"use client";

import { useId } from "react";
import { useInterfaceAnimations } from "@/components/ui/interface-animations";

export function usePickerSemantics(label: string, keys: string[], activeIndex: number | null, busy = false) {
	const proposed = useInterfaceAnimations() !== null;
	const id = useId();
	const optionId = (key: string) => `${id}-option-${encodeURIComponent(key)}`;
	const activeKey = activeIndex === null ? undefined : keys[activeIndex];
	return {
		input: proposed ? {
			role: "combobox" as const,
			"aria-label": label.toLowerCase().startsWith("search ") ? label : `Search ${label.toLowerCase()}`,
			"aria-autocomplete": "list" as const,
			"aria-expanded": true,
			"aria-controls": id,
			"aria-activedescendant": activeKey === undefined ? undefined : optionId(activeKey),
		} : {},
		list: proposed ? { id, role: "listbox" as const, "aria-label": label.replace(/^Search /i, ""), "aria-busy": busy } : {},
		item: proposed ? { role: "presentation" as const } : {},
		option: (key: string, selected: boolean) => proposed ? {
			id: optionId(key),
			role: "option" as const,
			"aria-selected": selected,
			"data-menu-selected": selected,
			tabIndex: -1,
		} : {},
	};
}
