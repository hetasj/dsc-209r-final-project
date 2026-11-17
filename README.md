# Abortion Access and Travel Across U.S. States

DSC 209R Final Project by Heta Joshi and Jade Romero.

An interactive D3.js visualization of how access to abortion care differed across U.S. states before the 2022 Dobbs decision, using the Guttmacher Institute's state-level data.

## Files

- `index.html`: page structure, research question, and writeup
- `style.css`: layout and styling
- `main.js`: D3 map, ranked bar chart, and interactions
- `abortion_access_by_state.csv`: cleaned data, one row per state, exported from `GuttmacherInstituteAbortionDataByState.xlsx`

## Data and modifications

The source data is `GuttmacherInstituteAbortionDataByState.xlsx` from the Guttmacher Institute, provided by the course. The original workbook has 51 rows (the 50 states and D.C.) and 31 columns, plus a metadata sheet of notes. We made `abortion_access_by_state.csv` from it with these changes:

1. **Converted to CSV** We exported only the main data sheet, since the visualization does not use the metadata notes.
2. **Kept 10 of the 31 columns** We kept the columns that measure access and incidence and dropped the rest (public funding from 2010 and 2015, provider counts from 2014 and 2017, teen age-group breakdowns other than ages 15-19, the share of all U.S. abortions, and the % change in abortion rate). We may add some of these back in later versions.
3. **Renamed columns** We replaced the long original names with short names that are easier to use in code (see the table below).
4. **Added one calculated column: `net_patients`** It equals abortions by state of occurrence minus abortions by state of residence (2020). A positive value means the state provided more abortions than its own residents obtained, so it took in patients from other states. A negative value means residents obtained care elsewhere.

We did not change, round, or fill in any values. All 51 rows have values for every column we kept.

| CSV column | Original column |
| --- | --- |
| `state` | U.S. State |
| `travel_out_pct` | % of residents obtaining abortions who traveled out of state for care, 2020 |
| `women_no_clinic_pct` | % of women aged 15-44 living in a county without a clinic, 2020 |
| `counties_no_clinic_pct` | % of counties without a known clinic, 2020 |
| `rate_residence` | No. of abortions per 1,000 women aged 15–44, by state of residence, 2020 |
| `rate_occurrence` | No. of abortions per 1,000 women aged 15–44, by state of occurrence, 2020 |
| `abortions_occurrence` | No. of abortions, by state of occurrence, 2020 |
| `abortions_residence` | No. of abortions, by state of residence, 2020 |
| `clinics_2020` | No. of abortion clinics, 2020 |
| `clinic_change_2017_2020` | Change in the no. of abortion clinics, 2017-2020 |
| `teen_rate_15_19_2017` | Abortion rate (the no. of abortions per 1,000 women aged 15-19), by state of residence, 2017 |
| `net_patients` | Calculated: abortions by state of occurrence minus abortions by state of residence, 2020 |

Note that the measures come from different years (2017 and 2020), and all of them predate the 2022 Dobbs decision. Each measure in the visualization is labeled with its year.

## Features so far

- A measure menu with eight access measures (out-of-state travel, clinic deserts, net patients, rates, clinic changes, teen rates)
- A U.S. map colored by the selected measure, with a legend
- A ranked bar chart of all 50 states and D.C., linked to the map
- Hover tooltips with value and rank, and click-to-highlight in both views
