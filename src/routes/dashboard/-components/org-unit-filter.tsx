/**
 * OrgUnitFilter — [Batch ▾] [Branch ▾] [Section ▾] in a single row.
 *
 * Batch is the admission year of the tenant's YEAR units ("Civil Engineering 2024" → 2024), limited to the chosen
 * branch's years; a tenant without them has no Batch filter. Branch is a department, Section a class.
 * The choice becomes `unitId`: one unit, or a batch's YEAR units comma-separated; the server shows their subtrees.
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
	/** Org units scoped to the current user */
	allOrgUnits: FilterOrgUnit[];
	value: OrgUnitFilterValue;
	onChange: (next: OrgUnitFilterValue) => void;
};

// ponytail: eng-labs' level names (VNR: STREAM > DEPARTMENT > YEAR > CLASS). A tenant that names its levels
// differently gets no filter here; read the levels from unit_schemas if one shows up.
const BRANCH = "DEPARTMENT";
const YEAR = "YEAR";
const SECTION = "CLASS";

const yearOf = (unit?: FilterOrgUnit) => unit?.name.match(/\b(?:19|20)\d{2}\b/g)?.at(-1);

const dropdownClass =
	"h-8 min-w-[160px] rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground shadow-none hover:bg-muted/50";

/** What the three dropdowns list, and what the current `unitId` selects. */
export function unitFilterOptions(allOrgUnits: FilterOrgUnit[], unitId?: string) {
	const byId = new Map(allOrgUnits.map((u) => [u.id, u]));
	const up = (unit: FilterOrgUnit | undefined, type: string) => {
		for (let u = unit; u; u = byId.get(u.parentId ?? "")) if (u.type === type) return u;
	};
	const ofType = (type: string) => allOrgUnits.filter((u) => u.type === type);
	const years = ofType(YEAR);
	const selected = (unitId?.split(",") ?? []).flatMap((id) => byId.get(id) ?? []);
	const branchIds = new Set(selected.map((u) => up(u, BRANCH)?.id));
	const branch = branchIds.size === 1 ? [...branchIds][0] : undefined;
	const batch = yearOf(up(selected[0], YEAR));
	const branchYears = years.filter((y) => !branch || up(y, BRANCH)?.id === branch);
	return {
		up,
		years,
		branch,
		batch,
		section: selected.length === 1 && selected[0].type === SECTION ? selected[0].id : undefined,
		batches: [...new Set(branchYears.flatMap((y) => yearOf(y) ?? []))].sort().reverse(),
		branches: ofType(BRANCH),
		sections: ofType(SECTION).filter(
			(c) => (!branch || up(c, BRANCH)?.id === branch) && (!batch || yearOf(up(c, YEAR)) === batch),
		),
	};
}

export function OrgUnitFilter({ allOrgUnits, value, onChange }: OrgUnitFilterProps) {
	const f = useMemo(() => unitFilterOptions(allOrgUnits, value.unitId), [allOrgUnits, value.unitId]);

	/** A section, else the batch's YEAR units (within the branch), else the branch. */
	const pick = (batch?: string, branch?: string, section?: string) => {
		const years = f.years.filter((y) => batch && yearOf(y) === batch && (!branch || f.up(y, BRANCH)?.id === branch));
		onChange({
			packageId: value.packageId,
			unitId: section ?? (years.length > 0 ? years.map((y) => y.id).join(",") : branch),
		});
	};

	const picker = (
		label: string,
		items: { id: string; name: string }[],
		current: string | undefined,
		placeholder: string,
		onPick: (id: string | undefined) => void,
	) =>
		items.length > 0 && (
			<div className="flex items-center gap-2">
				<span className="font-medium text-muted-foreground text-xs">{label}</span>
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
			<div className="flex items-center gap-1.5 text-muted-foreground text-xs">
				<FunnelSimpleIcon weight="duotone" className="size-3.5" />
				<span className="font-medium">{t`Filters`}</span>
			</div>
			{picker(
				t`Batch`,
				f.batches.map((y) => ({ id: y, name: y })),
				f.batch,
				t`All batches`,
				(y) => pick(y, f.branch),
			)}
			{picker(t`Branch`, f.branches, f.branch, t`All branches`, (id) => pick(f.batch, id))}
			{picker(t`Section`, f.sections, f.section, t`All sections`, (id) => pick(f.batch, f.branch, id))}
		</div>
	);
}
