// Source registry. To add a source: implement StartupSource in a new folder and list it here.
import type { StartupSource } from "@/lib/types";
import { ycSource } from "./yc";
import { himalayasSource } from "./jobs/himalayas";
import { fundingSource } from "./funding";
import { searchSource } from "./search";
import { companyCareersSource } from "./company";
import { ossSource } from "./oss";
import { productHuntSource } from "./producthunt";

/** Order matters: richer sources first so later ones merge into existing records. */
export const SOURCES: StartupSource[] = [ycSource, productHuntSource, himalayasSource, searchSource, fundingSource];

/** Runs after the others, using what's already stored. ossSource fills its own table (open-source projects). */
export const ENRICHERS: StartupSource[] = [companyCareersSource, ossSource];
