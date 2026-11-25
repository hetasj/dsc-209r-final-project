// Abortion access across U.S. states
// A choropleth map and a ranked bar chart, linked by hover and click, both driven by one selected measure

const MEASURES = [
    {
        key: "abortions_occurrence",
        label: "Abortions provided in the state (2020)",
        note: "Number of abortions provided in each state, counted by state of occurrence.",
        format: d => d3.format(",")(d),
        scale: "sequential"
    },
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
let current = MEASURES[1];
let storyStates = [];
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

    // Scatter (story steps)
    const scW = 420, scH = 380, scM = { top: 22, right: 24, bottom: 44, left: 48 };
    const scatterSvg = d3.select("#scatter").append("svg").attr("viewBox", `0 0 ${scW} ${scH}`);
    const scatterG = scatterSvg.append("g").attr("transform", `translate(${scM.left},${scM.top})`);
    const scIW = scW - scM.left - scM.right, scIH = scH - scM.top - scM.bottom;
    const sx = d3.scaleLinear([0, 100], [0, scIW]);
    const sy = d3.scaleLinear([0, 100], [scIH, 0]);
    let scatterX = "women_no_clinic_pct", scatterY = "travel_out_pct";
    const sxAxis = scatterG.append("g").attr("class", "axis").attr("transform", `translate(0,${scIH})`);
    const syAxis = scatterG.append("g").attr("class", "axis");
    const sxTitle = scatterG.append("text").attr("class", "axis-title").attr("x", scIW / 2).attr("y", scIH + 36).attr("text-anchor", "middle");
    const syTitle = scatterG.append("text").attr("class", "axis-title").attr("transform", "rotate(-90)").attr("x", -scIH / 2).attr("y", -36).attr("text-anchor", "middle");
    const fitNote = scatterG.append("text").attr("class", "fit-note").attr("x", 4).attr("y", -4);

    function drawScatter(xKey, yKey, xLabel, yLabel) {
        scatterX = xKey; scatterY = yKey;
        sx.domain([0, d3.max(rows, d => d[xKey])]).nice();
        sy.domain([0, d3.max(rows, d => d[yKey])]).nice();
        sxAxis.call(d3.axisBottom(sx).ticks(5));
        syAxis.call(d3.axisLeft(sy).ticks(5));
        sxTitle.text(xLabel); syTitle.text(yLabel);
        const r = d3.format(".2f")(sampleCorr(rows.map(d => d[xKey]), rows.map(d => d[yKey])));
        fitNote.text("Correlation across 51 states: " + r);
        scatterG.selectAll(".dot").data(rows, d => d.state).join("circle")
            .attr("class", "dot").attr("r", 5)
            .on("pointermove", (event, d) => hover(d.state, event))
            .on("pointerleave", unhover)
            .on("click", (event, d) => togglePin(d.state))
            .transition().duration(500)
            .attr("cx", d => sx(d[xKey])).attr("cy", d => sy(d[yKey]));
    }

    function sampleCorr(a, b) {
        const ma = d3.mean(a), mb = d3.mean(b);
        let num = 0, da = 0, db = 0;
        a.forEach((v, i) => { num += (v - ma) * (b[i] - mb); da += (v - ma) ** 2; db += (b[i] - mb) ** 2; });
        return num / Math.sqrt(da * db);
    }

    // Interaction helpers 
    function focusSet() {
        if (hovered) return new Set([hovered]);
        if (pinned) return new Set([pinned]);
        return new Set(storyStates);
    }

    const labelG = mapSvg.append("g");
    function applyFocus() {
        const focus = focusSet();
        const on = focus.size > 0;
        mapG.classed("has-focus", on);
        barG.classed("has-focus", on);
        scatterG.classed("has-focus", on);
        statePaths.classed("is-focus", d => focus.has(d.properties.name));
        barG.selectAll(".bar").classed("is-focus", d => focus.has(d.state));
        barG.selectAll(".bar-label").classed("is-focus", d => focus.has(d.state));
        scatterG.selectAll(".dot").classed("is-focus", d => focus.has(d.state));
        statePaths.filter(d => focus.has(d.properties.name)).raise();
        // Name labels on the map for the featured states
        const feats = states.filter(f => focus.has(f.properties.name) && path.centroid(f)[0]);
        labelG.selectAll("text").data(feats, f => f.properties.name).join("text")
            .attr("class", "map-label").attr("text-anchor", "middle")
            .attr("x", f => path.centroid(f)[0]).attr("y", f => path.centroid(f)[1] + 4)
            .text(f => STATE_ABBR[f.properties.name]);
        scatterG.selectAll(".dot-label").data(rows.filter(d => focus.has(d.state)), d => d.state).join("text")
            .attr("class", "dot-label")
            .attr("text-anchor", d => sx(d[scatterX]) > scIW * 0.7 ? "end" : "start")
            .attr("x", d => sx(d[scatterX]) + (sx(d[scatterX]) > scIW * 0.7 ? -8 : 8))
            .attr("y", d => sy(d[scatterY]) + 4)
            .text(d => d.state);
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
        legAxis.call(d3.axisBottom(legScale).ticks(5).tickSize(4).tickFormat(Math.max(Math.abs(lo), Math.abs(hi)) >= 20000 ? d3.format("~s") : current.format))
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

    // Guided story
    const STEPS = [
        { title: "Counts tell a misleading story", measure: "abortions_occurrence", view: "bars", states: ["California", "New York"],
          text: "California (154,060) and New York (110,360) provided the most abortions in 2020, but mostly because they have the most people. To understand access, we need to look beyond raw counts." },
        { title: "Clinic deserts", measure: "women_no_clinic_pct", view: "bars", states: ["Wyoming", "Missouri", "Mississippi", "West Virginia"],
          text: "In 2020, six states had only one abortion clinic. In Wyoming and Missouri, 96% and 94% of women aged 15-44 lived in a county with no clinic." },
        { title: "No clinic nearby, so residents travel", measure: "travel_out_pct", view: "scatter", x: "women_no_clinic_pct", y: "travel_out_pct",
          xLabel: "% of women in a county without a clinic", yLabel: "% of residents who traveled out of state",
          states: ["Missouri", "Wyoming", "South Dakota"],
          text: "States where more women lived far from a clinic also had more residents leaving the state for care. In Missouri, 99% of residents who obtained an abortion went to another state." },
        { title: "Where the patients went", measure: "net_patients", view: "bars", states: ["Illinois", "Missouri"],
          text: "Illinois provided 10,530 more abortions than its own residents obtained, while Missouri provided 11,540 fewer. The data does not track individual patients, but the two states are neighbors." },
        { title: "Less access, lower rates", measure: "rate_residence", view: "scatter", x: "women_no_clinic_pct", y: "rate_residence",
          xLabel: "% of women in a county without a clinic", yLabel: "Abortions per 1,000 women (by residence)",
          states: ["Wyoming", "New Jersey"],
          text: "States with fewer nearby clinics also had lower abortion rates among their residents. Wyoming had a rate of 6.4 per 1,000 women, compared with 28.9 in New Jersey." },
        { title: "Explore on your own", measure: null, view: "bars", states: [],
          text: "Choose any measure below to compare all 50 states and D.C. Hover over a state for its values, and click to keep it highlighted." }
    ];
    let step = 0;
    d3.select("#story-dots").selectAll("span").data(STEPS).join("span");

    function showStep(i) {
        step = i;
        const st = STEPS[i];
        pinned = null;
        storyStates = st.states;
        if (st.measure) current = MEASURES.find(m => m.key === st.measure);
        d3.select("#measure-select").property("value", current.key);
        d3.select("#story-step").text(`Step ${i + 1} of ${STEPS.length}`);
        d3.select("#story-title").text(st.title);
        d3.select("#story-text").text(st.text);
        d3.select("#story-back").property("disabled", i === 0);
        d3.select("#story-next").property("disabled", i === STEPS.length - 1);
        d3.select("#story-dots").selectAll("span").classed("active", (d, j) => j === i);
        d3.select("#explore-controls").style("display", st.measure ? "none" : null);
        d3.select("#bars").style("display", st.view === "bars" ? null : "none");
        d3.select("#scatter").style("display", st.view === "scatter" ? null : "none");
        update();
        if (st.view === "scatter") {
            drawScatter(st.x, st.y, st.xLabel, st.yLabel);
            d3.select("#bar-title").text(st.yLabel + " vs. " + st.xLabel.toLowerCase());
        }
        applyFocus();
    }
    d3.select("#story-back").on("click", () => showStep(Math.max(0, step - 1)));
    d3.select("#story-next").on("click", () => showStep(Math.min(STEPS.length - 1, step + 1)));

    drawScatter("women_no_clinic_pct", "travel_out_pct", "", "");
    showStep(0);
}).catch(error => {
    console.error(error);
    d3.select("#measure-note").text("The visualization could not load. Open the page through a web server so the CSV can be read.");
});
