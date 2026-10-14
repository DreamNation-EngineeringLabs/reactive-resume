/**
 * OrgUnitFilter — [Batch ▾] [Branch ▾] [Section ▾] in a single row.
 *
 * Batch is the placement package. Branch (department) and Section (class) both set `unitId`, and the
 * server shows that unit's subtree; Section lists only the chosen branch's classes.
 * For instructor scope the server sends only their assigned units (and those units' parents).
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

type FilterOrgUnit = {
	id: string;
	name: string;
	type: string;
	parentId: string | null;
};

type OrgUnitFilterProps = {
	/** Placement packages from the placement_packages table */
	packages: { id: string; name: string }[];
	/** Org units scoped to the current user */
	allOrgUnits: FilterOrgUnit[];
	value: OrgUnitFilterValue;
	onChange: (next: OrgUnitFilterValue) => void;
};

// ponytail: eng-labs' unit types for a branch and a section (VNR, demo tenant). A tenant that names its
// levels differently gets the Batch filter only; read the levels from unit_schemas if one shows up.
const BRANCH = "DEPARTMENT";
const SECTION = "CLASS";

const dropdownClass =
	"h-8 min-w-[160px] rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-none hover:bg-slate-50";

export function OrgUnitFilter({ packages, allOrgUnits, value, onChange }: OrgUnitFilterProps) {
	const { branchId, branches, sections } = useMemo(() => {
		const byId = new Map(allOrgUnits.map((u) => [u.id, u]));
		const branchOf = (unit?: FilterOrgUnit) => {
			for (let u = unit; u; u = byId.get(u.parentId ?? "")) if (u.type === BRANCH) return u.id;
		};
		const options = (type: string) => allOrgUnits.filter((u) => u.type === type);
		const branchId = branchOf(byId.get(value.unitId ?? ""));
		return {
			branchId,
			branches: options(BRANCH),
			sections: options(SECTION).filter((u) => !branchId || branchOf(u) === branchId),
		};
	}, [allOrgUnits, value.unitId]);

	const pickUnit = (unitId: string | undefined, unitType: string) =>
		onChange({ packageId: value.packageId, unitId, unitType: unitId && unitType });

	const picker = (
		label: string,
		items: { id: string; name: string }[],
		current: string | undefined,
		placeholder: string,
		onPick: (id: string | undefined) => void,
	) =>
		items.length > 0 && (
			<div className="flex items-center gap-2">
				<span className="font-medium text-slate-500 text-xs">{label}</span>
				<Combobox
					options={items.map((i) => ({ value: i.id, label: i.name }))}
					value={current ?? null}
					placeholder={placeholder}
					clearable={true}
					buttonProps={{ className: dropdownClass }}
					onValueChange={(v) => onPick(v ?? undefined)}
				/>
			</div>
		);

	return (
		<div className="flex flex-wrap items-center gap-3">
			<div className="flex items-center gap-1.5 text-slate-400 text-xs">
				<FunnelSimpleIcon weight="duotone" className="size-3.5" />
				<span className="font-medium">{t`Filters`}</span>
			</div>
			{picker(t`Batch`, packages, value.packageId, t`All batches`, (id) => onChange({ packageId: id }))}
			{picker(t`Branch`, branches, branchId, t`All branches`, (id) => pickUnit(id, BRANCH))}
			{picker(t`Section`, sections, value.unitType === SECTION ? value.unitId : undefined, t`All sections`, (id) =>
				id ? pickUnit(id, SECTION) : pickUnit(branchId, BRANCH),
			)}
		</div>
	);
}
