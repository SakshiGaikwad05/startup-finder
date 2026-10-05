// Source registry. To add a source: implement StartupSource in a new folder and list it here.
import type { StartupSource } from "@/lib/types";
import { ycSource } from "./yc";
import { remotiveSource } from "./jobs/remotive";
import { fundingSource } from "./funding";
import { searchSource } from "./search";
import { companyCareersSource } from "./company";

/** Order matters: richer sources first so later ones merge into existing records. */
export const SOURCES: StartupSource[] = [ycSource, remotiveSource, searchSource, fundingSource];

/** Runs after the others, using what's already stored. */
export const ENRICHERS: StartupSource[] = [companyCareersSource];
