/**
 * OrgUnitFilter — three compact dropdowns in a single row:
 *   [Package ▾]  [Type ▾]  [Unit ▾]
 *
 * Unit dropdown appears only after a type is selected.
 * For instructor scope the server already restricts allOrgUnits to assigned units only.
 */

import { t } from "@lingui/core/macro";
import { FunnelSimpleIcon } from "@phosphor-icons/react";
import { useMemo } from "react";
import { Combobox } from "@/components/ui/combobox";

export type OrgUnitFilterValue = {
	packageId?: string;
	unitType?: string;
	unitId?: string;
};

type FilterPackage = {
	id: string;
	name: string;
};

type FilterOrgUnit = {
	id: string;
	name: string;
	type: string;
	parentId: string | null;
};

type OrgUnitFilterProps = {
	/** Placement packages from the placement_packages table */
	packages: FilterPackage[];
	/** Distinct unit types from unit_schemas (e.g. STREAM, DEPARTMENT, CLASS) */
	unitTypes: string[];
	/** Org units scoped to the current user — filtered by type when one is selected */
	allOrgUnits: FilterOrgUnit[];
	value: OrgUnitFilterValue;
	onChange: (next: OrgUnitFilterValue) => void;
};

function formatUnitType(type: string): string {
	return type
		.split(/[_\s]+/)
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
		.join(" ");
}

const dropdownClass =
	"h-8 min-w-[160px] rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-none hover:bg-slate-50";

export function OrgUnitFilter({ packages, unitTypes, allOrgUnits, value, onChange }: OrgUnitFilterProps) {
	const packageOptions = useMemo(
		() => packages.map((p) => ({ value: p.id, label: p.name })),
		[packages],
	);

	const typeOptions = useMemo(
		() => unitTypes.map((t) => ({ value: t, label: formatUnitType(t) })),
		[unitTypes],
	);

	const unitOptions = useMemo(
		() =>
			value.unitType
				? allOrgUnits
						.filter((u) => u.type === value.unitType)
						.map((u) => ({ value: u.id, label: u.name }))
				: [],
		[allOrgUnits, value.unitType],
	);

	if (packages.length === 0 && unitTypes.length === 0) return null;

	return (
		<div className="flex flex-wrap items-center gap-3">
			<div className="flex items-center gap-1.5 text-slate-400 text-xs">
				<FunnelSimpleIcon weight="duotone" className="size-3.5" />
				<span className="font-medium">{t`Filters`}</span>
			</div>

			{/* Package */}
			{packages.length > 0 && (
				<div className="flex items-center gap-2">
					<span className="text-slate-500 text-xs font-medium">{t`Package`}</span>
					<Combobox
						options={packageOptions}
						value={value.packageId ?? null}
						placeholder={t`All packages`}
						clearable={true}
						buttonProps={{ className: dropdownClass }}
						onValueChange={(v) =>
							onChange({ packageId: v ?? undefined, unitType: undefined, unitId: undefined })
						}
					/>
				</div>
			)}

			{/* Type */}
			{unitTypes.length > 0 && (
				<div className="flex items-center gap-2">
					<span className="text-slate-500 text-xs font-medium">{t`Type`}</span>
					<Combobox
						options={typeOptions}
						value={value.unitType ?? null}
						placeholder={t`All types`}
						clearable={true}
						buttonProps={{ className: dropdownClass }}
						onValueChange={(v) =>
							onChange({ ...value, unitType: v ?? undefined, unitId: undefined })
						}
					/>
				</div>
			)}

			{/* Unit — only shown when a type is selected and there are units for it */}
			{value.unitType && unitOptions.length > 0 && (
				<div className="flex items-center gap-2">
					<span className="text-slate-500 text-xs font-medium">{formatUnitType(value.unitType)}</span>
					<Combobox
						options={unitOptions}
						value={value.unitId ?? null}
						placeholder={`All ${formatUnitType(value.unitType)}s`}
						clearable={true}
						buttonProps={{ className: dropdownClass }}
						onValueChange={(v) => onChange({ ...value, unitId: v ?? undefined })}
					/>
				</div>
			)}
		</div>
	);
}
