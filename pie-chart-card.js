import "https://unpkg.com/chart.js@v2.9.3/dist/Chart.bundle.min.js?module";

console.info(
  `%cPIE-CHART-CARD\n%cVersion: 0.0.2`,
  "color: white; background: olive; font-weight: bold;",
  "color: olive; background: white; font-weight: bold;",
  ""
);

class PieChartCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  setConfig(config) {
    if (!config.entities) {
      throw new Error('You need to define an entity');
    }
    const root = this.shadowRoot;
    if (root.lastChild) root.removeChild(root.lastChild);

    const card = document.createElement('ha-card');
    const content = document.createElement('div');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const style = document.createElement('style');

    card.id ='ha-card';
    content.id = 'content';
    canvas.id = 'cnv';
    content.style.height = '480px';
    canvas.height=480;
    card.appendChild(content);
    card.appendChild(style);
    content.appendChild(canvas);
    root.appendChild(card);
    this._config = config;
  }

  set hass(hass) {
    const root = this.shadowRoot;
    const config = this._config;
    const card = root.getElementById("ha-card");
    const content = root.getElementById("content");
    const canvas = root.getElementById("cnv");
    const ctx = canvas.getContext('2d');
    
    // Retrieve computed styles to fetch Home Assistant CSS variables
    const computedStyles = getComputedStyle(this);
    
    // Grab the 10 standard HA theme graph colors (with hex fallbacks just in case)
    const defaultColors = [
      computedStyles.getPropertyValue('--graph-color-1').trim() || '#326BFF',
      computedStyles.getPropertyValue('--graph-color-2').trim() || '#E03C31',
      computedStyles.getPropertyValue('--graph-color-3').trim() || '#379B48',
      computedStyles.getPropertyValue('--graph-color-4').trim() || '#E1B32A',
      computedStyles.getPropertyValue('--graph-color-5').trim() || '#A93EE0',
      computedStyles.getPropertyValue('--graph-color-6').trim() || '#FF9800',
      computedStyles.getPropertyValue('--graph-color-7').trim() || '#00BCD4',
      computedStyles.getPropertyValue('--graph-color-8').trim() || '#E91E63',
      computedStyles.getPropertyValue('--graph-color-9').trim() || '#607D8B',
      computedStyles.getPropertyValue('--graph-color-10').trim() || '#795548'
    ];

    const hassEntities = config.entities.map(x => hass.states[x.entity]);
    
    // If a name is not provided, use the friendly_name for the entity. If the friendly_name
    // does not exist, use the actual entity.
    var entityNames = config.entities.map(x => x.name !== undefined ? x.name : hass.states[x.entity]["attributes"]["friendly_name"] !== undefined ? hass.states[x.entity]["attributes"]["friendly_name"] : x.entity);
    
    // Extract color if provided in the configuration, otherwise map to HA default graph colors
    var entityColors = config.entities.map((x, i) => x.color !== undefined ? x.color : defaultColors[i % defaultColors.length]);

    // If the entity does not exist, default to 0
    var entityData = hassEntities.map(x => x === undefined ? 0 : x.state);
    card.header = config.title ? config.title : 'Pie Chart';

    // If the legend does not exist, default to true
    const legend = config.legend != undefined ? config.legend : 'true';
    
    // If the height does not exist, default to 480px
    content.style.height = config.height != undefined ? config.height : '480px';

    if (config.total_amount){
        const totalEntity =  hass.states[config.total_amount]
        var total = 0;
        if (totalEntity !== undefined) {
          total = totalEntity.state;
        } else if (typeof(Number(config.total_amount)) === 'number') {
          total = Number(config.total_amount);
        } else {
          console.log("ERROR: config.total_amount must be either an entity or number.")
        }
        const measured = hassEntities.map(x => Number(x.state)).reduce(( accumulator, currentValue ) => accumulator + currentValue,  0);
        entityData.push(total - measured);
        entityNames.push(config.unknownText ? config.unknownText : 'Unknown');
        
        // Add a fallback color for the unknown portion
        entityColors.push(config.unknownColor ? config.unknownColor : computedStyles.getPropertyValue('--divider-color').trim() || '#d3d3d3');
    }

    const emptyIndexes = entityData.reduce((arr, e, i) => ((e == 0) && arr.push(i), arr), [])
    entityData = entityData.filter((element, index, array) => !emptyIndexes.includes(index));
    entityNames = entityNames.filter((element, index, array) => !emptyIndexes.includes(index));
    
    // Filter out colors associated with empty indexes so the chart aligns correctly
    entityColors = entityColors.filter((element, index, array) => !emptyIndexes.includes(index));

    const doughnutChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: [],
          datasets: [{
            data: [],
            borderWidth: 2,
            // Automatically blend the slice borders into the card background
            borderColor: computedStyles.getPropertyValue('--ha-card-background').trim() || '#ffffff',
            label: 'liveCount',
    }]
  },
       options: {
            responsive: true,
            maintainAspectRatio: false, // https://stackoverflow.com/a/53233861,
            animation: { duration: 0 },
            legend: {
                position: 'bottom',
                display: legend
             },
            hover: { mode: 'index' },
            // https://stackoverflow.com/a/49717859
            tooltips: {
              callbacks: {
                label: function(tooltipItem, data) {
                  var dataset = data.datasets[tooltipItem.datasetIndex];
                  var meta = dataset._meta[Object.keys(dataset._meta)[0]];
                  var total = meta.total;
                  var currentValue = dataset.data[tooltipItem.index];
                  var percentage = parseFloat((currentValue/total*100).toFixed(1));
                  return currentValue + ' (' + percentage + '%)';
                },
                title: function(tooltipItem, data) {
                  return data.labels[tooltipItem[0].index];
                }
              }
            },
        }
    });

  var getData = function() {
    const dataset = { data: entityData };
    
    // Apply our processed HA theme colors / specific YAML colors
    dataset.backgroundColor = entityColors;
    
    doughnutChart.data =  { datasets: [dataset], labels: entityNames };
    doughnutChart.update();
  };
  getData();
  }

  getCardSize() {
    return 3;
  }
}

customElements.define('pie-chart-card', PieChartCard);
