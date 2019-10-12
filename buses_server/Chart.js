class Chart {
      constructor(rows) {
            this.width = document.querySelector("#chart-wrapper").clientWidth;
            this.height = document.querySelector("#chart-wrapper").clientHeight;
            this.direction = rows[0].directionref;
            this.chartPreData = new Map();
            this.chartData = [];
            this.set_pre_chart_data(rows);
            this.set_chart_data();
            this.draw_chart();
            Chart.count++;
            Chart.instances.push(this);
            if (Chart.count === 2 ) Chart.draw_combined_chart();
      }

      static draw_combined_chart() {
            const wrapper = document.createElement('div');
            wrapper.id = "combined-wrapper";
            wrapper.className = "chart visible-chart";
            document.querySelector("#chart-wrapper").prepend(wrapper);

            Chart.instances.forEach(inst => {
                  const chartDiv = document.createElement('div');
                  chartDiv.id = "combined-chart-" + inst.direction;
                  chartDiv.style.height = "45px";
                  if (inst.direction === "0")
                        wrapper.appendChild(chartDiv);
                  else
                        wrapper.prepend(chartDiv);

                  const x = d3.scaleTime()
                        .domain(d3.extent(inst.chartData, d => d.date))
                        .range([0, inst.width]);

                  const y = d3.scaleLinear()
                        .domain([0, d3.max(inst.chartData, d => d.value)])
                        .range([(inst.direction === "0" ? 0 : inst.height / 2), (inst.direction === "0" ? inst.height / 2 : 0)]);

                  const svg = d3.select("#combined-chart-" + inst.direction).append("svg")
                        .attr("width", inst.width)
                        .attr("height", (inst.height / 2))
                        .append("g");

                  svg.append("path")
                        .datum(inst.chartData)
                        .attr("fill", inst.direction === "0" ? "#ffd4fc" : "#22e9ff")
                        .attr("fill-opacity", "0.60")
                        .attr("d", d3.area()
                              .x(d => x(d.date))
                              .y0(y(0))
                              .y1(d => y(d.value))
                              .curve(d3.curveMonotoneX)
                        );
            });
      }

      set_pre_chart_data(rows) {
            rows.forEach(x => {
                  const date = new Date(x.recordedattime);
                  const dateNoSeconds = new Date(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes()).getTime();
                  if (this.chartPreData.has(dateNoSeconds))
                        this.chartPreData.get(dateNoSeconds).push(x);
                  else
                        this.chartPreData.set(dateNoSeconds, [x]);
            });
      }

      set_chart_data() {
            this.chartPreData.forEach((value, key) => {
                  let count = 0;
                  const noDupes = value.filter((x, I) => {
                        return !(value.some((y, i) => x.vehicleref === y.vehicleref && I < i))
                  });
                  noDupes.forEach((obj, i, arr) => {
                        count += arr.some(x => {
                              return distance(obj.latitude, obj.longitude, x.latitude, x.longitude) * 1000 <= Number(factor.value) && x.vehicleref !== obj.vehicleref
                        }) ? 1 : 0;
                  });
                  this.chartData.push({date: new Date(key), value: count});
                  // graphData0.set(key, noDupes);
            });
      }

      draw_chart() {
            const chartDiv = document.createElement('div');
            chartDiv.id = "chart-" + this.direction;
            chartDiv.className = "chart hidden-chart";
            document.querySelector("#chart-wrapper").appendChild(chartDiv);
            if (this.direction === "0")
                  document.querySelector("#chart-wrapper").appendChild(chartDiv);
            else
                  document.querySelector("#chart-wrapper").prepend(chartDiv);

            const x = d3.scaleTime()
                .domain(d3.extent(this.chartData, d => d.date))
                .range([0, this.width]);

            const y = d3.scaleLinear()
                .domain([0, d3.max(this.chartData, d => d.value)])
                .range([this.height, 0]);

            const svg = d3.select("#chart-" + this.direction).append("svg")
                .attr("width", this.width)
                .attr("height", this.height)
                .append("g");

            svg.append("path")
                .datum(this.chartData)
                .attr("fill", this.direction === "0" ? "#ffd4fc" : "#22e9ff")
                .attr("fill-opacity", "0.60")
                .attr("d", d3.area()
                    .x(d => x(d.date))
                    .y0(y(0))
                    .y1(d => y(d.value))
                    .curve(d3.curveMonotoneX)
                );
      }
}

Chart.count = 0;
Chart.instances = [];
