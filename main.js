// Abortion access across US states initial prototype
// A choropleth map and a ranked bar chart, linked by hover and click, both driven by one selected measure

const MEASURES = [
    {
        key: "travel_out_pct",
        label: "Residents who traveled out of state for care (2020)",
        note: "Share of residents obtaining abortions who traveled to another state for care.",
        format: d => d + "%",
        scale: "sequential"
    },
    {
        key: "women_no_clinic_pct",
        label: "Women living in a county without a clinic (2020)",
        note: "Share of women aged 15-44 living in a county with no abortion clinic.",
        format: d => d + "%",
        scale: "sequential"
    },
    {
        key: "counties_no_clinic_pct",
        label: "Counties without a clinic (2020)",
        note: "Share of the state's counties with no known abortion clinic.",
        format: d => d + "%",
        scale: "sequential"
    },
    {
        key: "net_patients",
        label: "Abortions provided minus residents' abortions (2020)",
        note: "Positive values mean the state provided more abortions than its own residents obtained (it took in patients). Negative values mean residents went elsewhere.",
        format: d => (d > 0 ? "+" : "") + d3.format(",")(d),
        scale: "diverging"
    },
    {
        key: "rate_residence",
        label: "Abortion rate by state of residence (2020)",
        note: "Abortions per 1,000 women aged 15-44, counted by where patients lived.",
        format: d => d3.format(".1f")(d),
        scale: "sequential"
    },
    {
        key: "rate_occurrence",
        label: "Abortion rate by state of occurrence (2020)",
        note: "Abortions per 1,000 women aged 15-44, counted by where the abortion was provided.",
        format: d => d3.format(".1f")(d),
        scale: "sequential"
    },
    {
        key: "clinic_change_2017_2020",
        label: "Change in number of clinics (2017-2020)",
        note: "Clinics gained or lost between 2017 and 2020.",
        format: d => (d > 0 ? "+" : "") + d,
        scale: "diverging"
    },
    {
        key: "teen_rate_15_19_2017",
        label: "Teen abortion rate, ages 15-19 (2017)",
        note: "Abortions per 1,000 women aged 15-19, by state of residence.",
        format: d => d3.format(".1f")(d),
        scale: "sequential"
    }
];

const STATE_ABBR = {
    "Alabama": "AL", "Alaska": "AK", "Arizona": "AZ", "Arkansas": "AR", "California": "CA",
    "Colorado": "CO", "Connecticut": "CT", "Delaware": "DE", "District of Columbia": "DC",
    "Florida": "FL", "Georgia": "GA", "Hawaii": "HI", "Idaho": "ID", "Illinois": "IL",
    "Indiana": "IN", "Iowa": "IA", "Kansas": "KS", "Kentucky": "KY", "Louisiana": "LA",
    "Maine": "ME", "Maryland": "MD", "Massachusetts": "MA", "Michigan": "MI", "Minnesota": "MN",
    "Mississippi": "MS", "Missouri": "MO", "Montana": "MT", "Nebraska": "NE", "Nevada": "NV",
    "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY",
    "North Carolina": "NC", "North Dakota": "ND", "Ohio": "OH", "Oklahoma": "OK", "Oregon": "OR",
    "Pennsylvania": "PA", "Rhode Island": "RI", "South Carolina": "SC", "South Dakota": "SD",
    "Tennessee": "TN", "Texas": "TX", "Utah": "UT", "Vermont": "VT", "Virginia": "VA",
    "Washington": "WA", "West Virginia": "WV", "Wisconsin": "WI", "Wyoming": "WY"
};

const tooltip = d3.select("#tooltip");
let current = MEASURES[0];
let pinned = null;
let hovered = null;

Promise.all([
    d3.csv("abortion_access_by_state.csv", d3.autoType),
    d3.json("https://cdn.jsdelivr.net/npm/us-atlas@3.0.1/states-10m.json")
]).then(([rows, us]) => {
    const byState = new Map(rows.map(d => [d.state, d]));
    const states = topojson.feature(us, us.objects.states).features
        .filter(f => byState.has(f.properties.name));

    // Map
    const mapW = 640, mapH = 400;
    const projection = d3.geoAlbersUsa().fitSize([mapW, mapH], { type: "FeatureCollection", features: states });
    const path = d3.geoPath(projection);
    const mapSvg = d3.select("#map").append("svg")
        .attr("viewBox", `0 0 ${mapW} ${mapH}`)
        .attr("role", "img")
        .attr("aria-label", "U.S. map colored by the selected measure");
    const mapG = mapSvg.append("g");
    const statePaths = mapG.selectAll("path")
        .data(states)
        .join("path")
        .attr("class", "state")
        .attr("d", path);

    // Legend
    const legW = 320, legH = 46;
    const legSvg = d3.select("#legend").append("svg").attr("viewBox", `0 0 ${legW} ${legH}`);
    const defs = legSvg.append("defs");
    const grad = defs.append("linearGradient").attr("id", "legend-gradient");
    legSvg.append("rect").attr("x", 10).attr("y", 8).attr("width", 300).attr("height", 12)
        .attr("fill", "url(#legend-gradient)");
    const legAxis = legSvg.append("g").attr("class", "axis").attr("transform", "translate(0,20)");

    // Ranked bars 
    const barW = 420, rowH = 14, barMargin = { top: 18, right: 56, bottom: 8, left: 112 };
    const barH = barMargin.top + rows.length * rowH + barMargin.bottom;
    const barSvg = d3.select("#bars").append("svg")
        .attr("viewBox", `0 0 ${barW} ${barH}`)
        .attr("role", "img")
        .attr("aria-label", "All states ranked by the selected measure");
    const barG = barSvg.append("g").attr("transform", `translate(${barMargin.left},${barMargin.top})`);
    const innerW = barW - barMargin.left - barMargin.right;
    const xAxisG = barG.append("g").attr("class", "axis");
    const zeroLine = barG.append("line").attr("stroke", "#8b949e");

    // Interaction helpers
    function focusState() { return hovered || pinned; }

    function applyFocus() {
        const focus = focusState();
        mapG.classed("has-focus", focus !== null);
        barG.classed("has-focus", focus !== null);
        statePaths.classed("is-focus", d => d.properties.name === focus);
        barG.selectAll(".bar").classed("is-focus", d => d.state === focus);
        barG.selectAll(".bar-label").classed("is-focus", d => d.state === focus);
        if (focus) statePaths.filter(d => d.properties.name === focus).raise();
    }

    function showTooltip(name, event) {
        const d = byState.get(name);
        if (!d) return;
        const rank = rows.slice().sort((a, b) => d3.descending(a[current.key], b[current.key]))
            .findIndex(r => r.state === name) + 1;
        tooltip.html(
            `<strong>${name}</strong>` +
            `${current.label}: <b>${current.format(d[current.key])}</b><br>` +
            `Rank: ${rank} of ${rows.length}<br>` +
            `Clinics in 2020: ${d.clinics_2020}`
        ).classed("visible", true);
        const box = tooltip.node().getBoundingClientRect();
        let x = event.clientX + 14, y = event.clientY + 14;
        if (x + box.width > window.innerWidth - 8) x = event.clientX - box.width - 14;
        if (y + box.height > window.innerHeight - 8) y = event.clientY - box.height - 14;
        tooltip.style("left", x + "px").style("top", y + "px");
    }

    function hover(name, event) { hovered = name; showTooltip(name, event); applyFocus(); }
    function unhover() { hovered = null; tooltip.classed("visible", false); applyFocus(); }
    function togglePin(name) { pinned = pinned === name ? null : name; applyFocus(); }

    statePaths
        .on("pointermove", (event, d) => hover(d.properties.name, event))
        .on("pointerleave", unhover)
        .on("click", (event, d) => togglePin(d.properties.name));

    // Update for the selected measure 
    function update() {
        const values = rows.map(d => d[current.key]);
        let color;
        if (current.scale === "diverging") {
            const m = d3.max(values, Math.abs);
            color = d3.scaleDiverging([-m, 0, m], d3.interpolateBrBG);
        } else {
            color = d3.scaleSequential([0, d3.max(values)], d3.interpolateYlOrRd);
        }

        statePaths.transition().duration(500)
            .attr("fill", d => color(byState.get(d.properties.name)[current.key]));

        // Legend
        const stops = d3.range(0, 1.01, 0.1);
        const [lo, hi] = current.scale === "diverging" ? [color.domain()[0], color.domain()[2]] : color.domain();
        grad.selectAll("stop").data(stops).join("stop")
            .attr("offset", t => t * 100 + "%")
            .attr("stop-color", t => color(lo + t * (hi - lo)));
        const legScale = d3.scaleLinear([lo, hi], [10, 310]);
        legAxis.call(d3.axisBottom(legScale).ticks(5).tickSize(4).tickFormat(current.format))
            .call(g => g.select(".domain").remove());

        // Bars
        const sorted = rows.slice().sort((a, b) => d3.descending(a[current.key], b[current.key]));
        const y = d3.scaleBand(sorted.map(d => d.state), [0, sorted.length * rowH]).padding(0.15);
        const ext = d3.extent(values);
        const x = d3.scaleLinear([Math.min(0, ext[0]), Math.max(0, ext[1])], [0, innerW]).nice();

        xAxisG.call(d3.axisTop(x).ticks(4).tickSize(3).tickFormat(current.format))
            .call(g => g.select(".domain").remove());
        zeroLine.attr("x1", x(0)).attr("x2", x(0)).attr("y1", 0).attr("y2", sorted.length * rowH);

        barG.selectAll(".bar").data(sorted, d => d.state).join("rect")
            .attr("class", "bar")
            .on("pointermove", (event, d) => hover(d.state, event))
            .on("pointerleave", unhover)
            .on("click", (event, d) => togglePin(d.state))
            .transition().duration(500)
            .attr("y", d => y(d.state))
            .attr("height", y.bandwidth())
            .attr("x", d => x(Math.min(0, d[current.key])))
            .attr("width", d => Math.abs(x(d[current.key]) - x(0)))
            .attr("fill", d => color(d[current.key]));

        barG.selectAll(".bar-label").data(sorted, d => d.state).join("text")
            .attr("class", "bar-label")
            .attr("text-anchor", "end")
            .attr("x", -6)
            .attr("dy", "0.35em")
            .text(d => d.state)
            .transition().duration(500)
            .attr("y", d => y(d.state) + y.bandwidth() / 2);

        barG.selectAll(".bar-value").data(sorted, d => d.state).join("text")
            .attr("class", "bar-value")
            .attr("dy", "0.35em")
            .text(d => current.format(d[current.key]))
            .transition().duration(500)
            .attr("y", d => y(d.state) + y.bandwidth() / 2)
            .attr("x", d => Math.max(x(d[current.key]), x(0)) + 4);

        d3.select("#bar-title").text("All states ranked: " + current.label);
        d3.select("#measure-note").text(current.note);
        applyFocus();
    }

    d3.select("#measure-select")
        .on("change", event => {
            current = MEASURES.find(m => m.key === event.target.value);
            update();
        })
        .selectAll("option")
        .data(MEASURES)
        .join("option")
        .attr("value", d => d.key)
        .text(d => d.label);

    update();
}).catch(error => {
    console.error(error);
    d3.select("#measure-note").text("The visualization could not load. Open the page through a web server so the CSV can be read.");
});
