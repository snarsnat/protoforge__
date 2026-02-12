/**
 * BOM (Bill of Materials) Management
 * Inspired by schematic.io's part browser and BOM system
 */

import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Common electronic components database
 * In production, this would query a real component API (DigiKey, Mouser, Octopart)
 */
export const COMPONENT_DATABASE = {
  // Microcontrollers
  'esp32': {
    name: 'ESP32-WROOM-32',
    category: 'Microcontroller',
    description: 'WiFi & Bluetooth module',
    price: 3.50,
    supplier: 'AliExpress',
    link: 'https://www.aliexpress.com/item/32737693930.html',
    datasheet: 'https://www.espressif.com/sites/default/files/documentation/esp32_datasheet_en.pdf'
  },
  'arduino-nano': {
    name: 'Arduino Nano',
    category: 'Microcontroller',
    description: 'ATmega328P based development board',
    price: 5.00,
    supplier: 'Arduino',
    link: 'https://store.arduino.cc/arduino-nano',
    datasheet: 'https://www.arduino.cc/en/Main/ArduinoBoardNano'
  },
  'rp2040': {
    name: 'Raspberry Pi Pico',
    category: 'Microcontroller',
    description: 'RP2040 based microcontroller',
    price: 4.00,
    supplier: 'Raspberry Pi',
    link: 'https://www.raspberrypi.com/products/raspberry-pi-pico/',
    datasheet: 'https://datasheets.raspberrypi.com/pico/pico-datasheet.pdf'
  },
  'stm32': {
    name: 'STM32F103C8T6',
    category: 'Microcontroller',
    description: 'ARM Cortex-M3 blue pill',
    price: 2.00,
    supplier: 'AliExpress',
    link: 'https://www.aliexpress.com/item/32856429667.html',
    datasheet: 'https://www.st.com/resource/en/datasheet/stm32f103c8.pdf'
  },
  
  // Sensors
  'dht11': {
    name: 'DHT11',
    category: 'Sensor',
    description: 'Temperature & humidity sensor',
    price: 1.00,
    supplier: 'AliExpress',
    link: 'https://www.aliexpress.com/item/32727870817.html',
    datasheet: 'https://www.sparkfun.com/datasheets/Sensors/Temperature/DHT11.pdf'
  },
  'dht22': {
    name: 'DHT22',
    category: 'Sensor',
    description: 'High precision temp & humidity',
    price: 4.00,
    supplier: 'AliExpress',
    link: 'https://www.aliexpress.com/item/32727870817.html',
    datasheet: 'https://www.sparkfun.com/datasheets/Sensors/Temperature/DHT22.pdf'
  },
  'bmp280': {
    name: 'BMP280',
    category: 'Sensor',
    description: 'Barometric pressure sensor',
    price: 1.50,
    supplier: 'AliExpress',
    link: 'https://www.aliexpress.com/item/32961400731.html',
    datasheet: 'https://www.bosch-sensortec.com/media/boschsensortec/downloads/datasheets/bst-bmp280-ds001.pdf'
  },
  'mq135': {
    name: 'MQ-135',
    category: 'Sensor',
    description: 'Air quality sensor',
    price: 1.20,
    supplier: 'AliExpress',
    link: 'https://www.aliexpress.com/item/32818294271.html',
    datasheet: 'https://www.sparkfun.com/datasheets/Sensors/gas/MQ-135.pdf'
  },
  'ultrasonic-hc-sr04': {
    name: 'HC-SR04',
    category: 'Sensor',
    description: 'Ultrasonic distance sensor',
    price: 0.80,
    supplier: 'AliExpress',
    link: 'https://www.aliexpress.com/item/32681749225.html',
    datasheet: 'https://cdn.sparkfun.com/datasheets/Sensors/Proximity/HCSR04.pdf'
  },
  'pir-hc-sr501': {
    name: 'HC-SR501',
    category: 'Sensor',
    description: 'PIR motion sensor',
    price: 0.70,
    supplier: 'AliExpress',
    link: 'https://www.aliexpress.com/item/32727872345.html',
    datasheet: 'https://www.mpja.com/download/31227sc.pdf'
  },
  'soil-moisture': {
    name: 'Capacitive Soil Moisture',
    category: 'Sensor',
    description: 'Soil moisture sensor',
    price: 1.50,
    supplier: 'AliExpress',
    link: 'https://www.aliexpress.com/item/32886679833.html',
    datasheet: ''
  },
  'photoresistor': {
    name: 'GL5528',
    category: 'Sensor',
    description: 'Light dependent resistor',
    price: 0.10,
    supplier: 'AliExpress',
    link: 'https://www.aliexpress.com/item/32814375491.html',
    datasheet: ''
  },
  
  // Display
  'oled-128x64': {
    name: 'SSD1306 OLED 128x64',
    category: 'Display',
    description: '0.96" I2C OLED display',
    price: 2.50,
    supplier: 'AliExpress',
    link: 'https://www.aliexpress.com/item/32795436704.html',
    datasheet: 'https://cdn-shop.adafruit.com/datasheets/SSD1306.pdf'
  },
  'lcd-16x2': {
    name: 'HD44780 LCD 16x2',
    category: 'Display',
    description: '16x2 character LCD',
    price: 2.00,
    supplier: 'AliExpress',
    link: 'https://www.aliexpress.com/item/32822281130.html',
    datasheet: 'https://www.sparkfun.com/datasheets/LCD/HD44780.pdf'
  },
  'tft-display': {
    name: 'ILI9341 TFT 2.8"',
    category: 'Display',
    description: 'SPI color touchscreen',
    price: 8.00,
    supplier: 'AliExpress',
    link: 'https://www.aliexpress.com/item/32824680079.html',
    datasheet: 'https://cdn-shop.adafruit.com/datasheets/ILI9341.pdf'
  },
  
  // Power
  'lm7805': {
    name: 'LM7805',
    category: 'Power',
    description: '5V linear regulator',
    price: 0.30,
    supplier: 'AliExpress',
    link: 'https://www.aliexpress.com/item/32832822456.html',
    datasheet: 'https://www.ti.com/lit/ds/symlink/lm7805.pdf'
  },
  'lm1117-3v3': {
    name: 'LM1117-3.3V',
    category: 'Power',
    description: '3.3V linear regulator',
    price: 0.25,
    supplier: 'AliExpress',
    link: 'https://www.aliexpress.com/item/32832822456.html',
    datasheet: 'https://www.ti.com/lit/ds/symlink/lm1117.pdf'
  },
  'dc-dc-buck': {
    name: 'MP1584 Buck Converter',
    category: 'Power',
    description: '3A DC-DC step down',
    price: 1.00,
    supplier: 'AliExpress',
    link: 'https://www.aliexpress.com/item/32673803021.html',
    datasheet: ''
  },
  '18650-battery': {
    name: '18650 Li-Ion Battery',
    category: 'Power',
    description: '3.7V 2600mAh battery',
    price: 5.00,
    supplier: 'AliExpress',
    link: 'https://www.aliexpress.com/item/32818252367.html',
    datasheet: ''
  },
  'tp4056': {
    name: 'TP4056 Charger',
    category: 'Power',
    description: 'Li-Ion battery charger module',
    price: 0.80,
    supplier: 'AliExpress',
    link: 'https://www.aliexpress.com/item/32825875661.html',
    datasheet: 'http://www.ti.com/lit/ds/symlink/tp4056.pdf'
  },
  
  // Connectivity
  'nrf24l01': {
    name: 'nRF24L01+',
    category: 'Connectivity',
    description: '2.4GHz RF transceiver',
    price: 1.00,
    supplier: 'AliExpress',
    link: 'https://www.aliexpress.com/item/32727865432.html',
    datasheet: 'https://www.nordicsemi.com/eng/Products/2-4GHz-RF/nRF24L01'
  },
  'esp8266': {
    name: 'ESP-01',
    category: 'Connectivity',
    description: 'WiFi module',
    price: 1.50,
    supplier: 'AliExpress',
    link: 'https://www.aliexpress.com/item/32727812345.html',
    datasheet: 'https://www.espressif.com/sites/default/files/documentation/esp8266_datasheet_en.pdf'
  },
  'bluetooth-hc05': {
    name: 'HC-05',
    category: 'Connectivity',
    description: 'Bluetooth SPP module',
    price: 2.00,
    supplier: 'AliExpress',
    link: 'https://www.aliexpress.com/item/32727898765.html',
    datasheet: 'https://www.sparkfun.com/datasheets/Wireless/Bluetooth/hc-05.pdf'
  },
  'sim800l': {
    name: 'SIM800L',
    category: 'Connectivity',
    description: 'GSM/GPRS module',
    price: 4.00,
    supplier: 'AliExpress',
    link: 'https://www.aliexpress.com/item/32822281122.html',
    datasheet: 'https://simcom.ee/documents/SIM800L/SIM800L_Hardware_Design_V1.09.pdf'
  },
  
  // Passives
  'resistor-10k': {
    name: 'Resistor 10KΩ',
    category: 'Passive',
    description: '1/4W 10KΩ resistor',
    price: 0.01,
    supplier: 'Generic',
    link: '',
    datasheet: ''
  },
  'resistor-220': {
    name: 'Resistor 220Ω',
    category: 'Passive',
    description: '1/4W 220Ω resistor',
    price: 0.01,
    supplier: 'Generic',
    link: '',
    datasheet: ''
  },
  'capacitor-100nf': {
    name: 'Capacitor 100nF',
    category: 'Passive',
    description: 'Ceramic capacitor 100nF',
    price: 0.02,
    supplier: 'Generic',
    link: '',
    datasheet: ''
  },
  'led-5mm': {
    name: 'LED 5mm',
    category: 'Passive',
    description: 'Standard 5mm LED',
    price: 0.05,
    supplier: 'Generic',
    link: '',
    datasheet: ''
  },
  'button': {
    name: 'Tactile Button',
    category: 'Passive',
    description: '6mm tactile switch',
    price: 0.03,
    supplier: 'Generic',
    link: '',
    datasheet: ''
  },
  
  // Connectors
  'jumper-wire': {
    name: 'Jumper Wire Kit',
    category: 'Connector',
    description: 'Male-male/male-female Dupont wires',
    price: 2.00,
    supplier: 'AliExpress',
    link: 'https://www.aliexpress.com/item/32898424931.html',
    datasheet: ''
  },
  'screw-terminal': {
    name: 'Screw Terminal 2.54mm',
    category: 'Connector',
    description: '2-pin screw terminal block',
    price: 0.15,
    supplier: 'AliExpress',
    link: 'https://www.aliexpress.com/item/32856789012.html',
    datasheet: ''
  },
  'usb-c-port': {
    name: 'USB-C Female Socket',
    category: 'Connector',
    description: 'USB-C 16-pin socket',
    price: 0.50,
    supplier: 'AliExpress',
    link: 'https://www.aliexpress.com/item/32856712345.html',
    datasheet: ''
  },
  
  // PCB
  'breadboard': {
    name: 'Breadboard 830',
    category: 'PCB',
    description: '830-point solderless breadboard',
    price: 3.00,
    supplier: 'AliExpress',
    link: 'https://www.aliexpress.com/item/32795381412.html',
    datasheet: ''
  },
  'protoboard': {
    name: 'PCB Prototype Board',
    category: 'PCB',
    description: '5x7cm perfboard',
    price: 1.50,
    supplier: 'AliExpress',
    link: 'https://www.aliexpress.com/item/32795381413.html',
    datasheet: ''
  },
  'pcb-fabrication': {
    name: 'PCB Fabrication (JLCPCB)',
    category: 'PCB',
    description: '5pcs 2-layer PCB',
    price: 2.00,
    supplier: 'JLCPCB',
    link: 'https://jlcpcb.com',
    datasheet: ''
  },
};

/**
 * Get component by ID
 */
export function getComponent(componentId) {
  return COMPONENT_DATABASE[componentId] || null;
}

/**
 * Search components
 */
export function searchComponents(query) {
  const q = query.toLowerCase();
  const results = [];
  
  for (const [id, component] of Object.entries(COMPONENT_DATABASE)) {
    const text = `${component.name} ${component.category} ${component.description}`.toLowerCase();
    if (text.includes(q)) {
      results.push({ id, ...component });
    }
  }
  
  return results;
}

/**
 * Get components by category
 */
export function getComponentsByCategory(category) {
  const results = [];
  for (const [id, component] of Object.entries(COMPONENT_DATABASE)) {
    if (component.category.toLowerCase() === category.toLowerCase()) {
      results.push({ id, ...component });
    }
  }
  return results;
}

/**
 * Generate BOM from prototype data
 */
export function generateBOM(prototype) {
  const bom = [];
  const seen = new Map();
  
  // Extract from codeSnippets
  if (prototype.codeSnippets) {
    for (const snippet of prototype.codeSnippets) {
      // Look for component references in code
      const content = snippet.content?.toLowerCase() || '';
      
      for (const [id, component] of Object.entries(COMPONENT_DATABASE)) {
        if (content.includes(id) || content.includes(component.name.toLowerCase())) {
          const key = id;
          if (!seen.has(key)) {
            seen.set(key, {
              id,
              partNumber: id.toUpperCase(),
              description: component.description,
              category: component.category,
              quantity: 1,
              unitPrice: component.price,
              supplier: component.supplier,
              link: component.link,
              datasheet: component.datasheet
            });
          } else {
            seen.get(key).quantity++;
          }
        }
      }
    }
  }
  
  // Add from explicit BOM in prototype
  if (prototype.bom) {
    for (const item of prototype.bom) {
      const key = item.partNumber?.toLowerCase() || item.id;
      if (!seen.has(key)) {
        seen.set(key, {
          id: key,
          ...item
        });
      }
    }
  }
  
  return Array.from(seen.values());
}

/**
 * Calculate BOM totals
 */
export function calculateBOMTotals(bom) {
  return {
    items: bom.length,
    totalQuantity: bom.reduce((sum, item) => sum + (item.quantity || 1), 0),
    estimatedCost: bom.reduce((sum, item) => sum + ((item.unitPrice || 0) * (item.quantity || 1)), 0),
    categories: [...new Set(bom.map(item => item.category))].filter(Boolean)
  };
}

/**
 * Export BOM to various formats
 */
export function exportBOM(bom, format = 'json') {
  switch (format) {
    case 'csv':
      return bomToCSV(bom);
    case 'markdown':
      return bomToMarkdown(bom);
    case 'json':
    default:
      return JSON.stringify(bom, null, 2);
  }
}

function bomToCSV(bom) {
  const headers = ['Part Number', 'Description', 'Category', 'Quantity', 'Unit Price', 'Total', 'Supplier', 'Link'];
  const rows = bom.map(item => [
    item.partNumber,
    item.description,
    item.category,
    item.quantity,
    item.unitPrice?.toFixed(2) || '0.00',
    ((item.unitPrice || 0) * (item.quantity || 1)).toFixed(2),
    item.supplier,
    item.link || ''
  ]);
  
  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

function bomToMarkdown(bom) {
  const totals = calculateBOMTotals(bom);
  
  let md = '# Bill of Materials\n\n';
  md += `**Total Items:** ${totals.items} | **Total Qty:** ${totals.totalQuantity} | **Est. Cost:** $${totals.estimatedCost.toFixed(2)}\n\n`;
  
  md += '| Part # | Description | Category | Qty | Price | Total | Supplier |\n';
  md += '|--------|-------------|----------|-----|-------|-------|----------|\n';
  
  for (const item of bom) {
    const total = (item.unitPrice || 0) * (item.quantity || 1);
    const link = item.link ? `[Link](${item.link})` : '';
    md += `| ${item.partNumber} | ${item.description} | ${item.category} | ${item.quantity} | $${(item.unitPrice || 0).toFixed(2)} | $${total.toFixed(2)} | ${item.supplier} ${link} |\n`;
  }
  
  return md;
}

/**
 * Parse BOM from various formats
 */
export async function parseBOM(input, format = 'auto') {
  if (typeof input === 'string') {
    // Try to detect format
    if (input.trim().startsWith('{') || input.trim().startsWith('[')) {
      return JSON.parse(input);
    }
    if (input.includes('|')) {
      return parseMarkdownTable(input);
    }
    if (input.includes(',')) {
      return parseCSV(input);
    }
  }
  
  return [];
}

function parseCSV(csv) {
  const lines = csv.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const items = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    const item = {};
    
    headers.forEach((h, idx) => {
      item[h] = values[idx] || '';
    });
    
    if (item.part_number || item['part #'] || item.partnumber) {
      items.push({
        partNumber: item.part_number || item['part #'] || item.partnumber,
        description: item.description || '',
        category: item.category || '',
        quantity: parseInt(item.quantity) || 1,
        unitPrice: parseFloat(item.price || item.unit_price || item.unitprice) || 0,
        supplier: item.supplier || '',
        link: item.link || ''
      });
    }
  }
  
  return items;
}

function parseMarkdownTable(markdown) {
  const lines = markdown.split('\n').filter(l => l.includes('|'));
  if (lines.length < 3) return [];
  
  const headers = lines[0].split('|').slice(1, -1).map(h => h.trim().toLowerCase());
  const items = [];
  
  for (let i = 2; i < lines.length; i++) {
    const values = lines[i].split('|').slice(1, -1).map(v => v.trim());
    const item = {};
    
    headers.forEach((h, idx) => {
      item[h] = values[idx] || '';
    });
    
    if (item.part || item['part #'] || item['part_number'] || item.partnumber) {
      items.push({
        partNumber: item.part || item['part #'] || item.part_number || item.partnumber,
        description: item.description || '',
        category: item.category || '',
        quantity: parseInt(item.quantity || item.qty || item.count) || 1,
        unitPrice: parseFloat(item.price || item.unit_price || '0') || 0,
        supplier: item.supplier || item.vendor || '',
        link: item.link || item.url || ''
      });
    }
  }
  
  return items;
}

export default {
  COMPONENT_DATABASE,
  getComponent,
  searchComponents,
  getComponentsByCategory,
  generateBOM,
  calculateBOMTotals,
  exportBOM,
  parseBOM
};
