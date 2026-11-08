const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const MASTER_DATA = {
  extrusion: [
    {
      id: "ext-1", qr: "EXT-BILLET-PUSHER", code: "01", name: "Billet Loading Cams & Pusher", doc: "CH/MT/102", plant: "EXTRUSION",
      items: [
        { eq: "Billet loading cams", it: "Pneumatic jack 1 & 2", lf: "Check Movement, speed, air leakages & brackets tightness" },
        { eq: "Billet loading cams", it: "Billet loading jack solenoid", lf: "Check air leakages & coil power supply cable damages" },
        { eq: "Pusher", it: "Pusher chain & bearings", lf: "Check free movement without tightness in the rail" },
        { eq: "Pusher", it: "Chain & sprockets", lf: "Check chain & sprockets condition / damages" },
        { eq: "Pusher", it: "Pusher stop proximity sensor", lf: "Check stop proximity sensor 1 & 2 (NO/NC)" }
      ]
    },
    {
      id: "ext-2", qr: "EXT-LOG-FURNACE", code: "02", name: "Log Furnace & Blower", doc: "CH/MT/102", plant: "EXTRUSION",
      items: [
        { eq: "Log Furnace", it: "LPG gas line", lf: "Check gas pressure before Hi pressure regulator" },
        { eq: "Log Furnace", it: "LPG gas line", lf: "Check gas pressure after low pressure regulator" },
        { eq: "Log Furnace", it: "LPG gas line", lf: "Check any LPG gas leakages" },
        { eq: "Log Furnace", it: "Emergency shut off valve", lf: "Check VRS operation in main line (power off burner)" },
        { eq: "Log Furnace", it: "Zone 1-4 combustion", lf: "Check burner operation 1-4 & combustion (flue gas smell, temp)" },
        { eq: "Log Furnace", it: "VRS valve & damper", lf: "Check VRS valve operation of hot air" },
        { eq: "Log Furnace", it: "Thermocouple probe", lf: "Check condition of function of thermocouple probe (Zone 1-4)" },
        { eq: "Log Furnace", it: "Pneumatic cylinder", lf: "Check air leakages of pneumatic cylinder" },
        { eq: "Hydraulic unit", it: "Hydraulic pump", lf: "Main pressure pump valve block 1" },
        { eq: "Hydraulic unit", it: "Hydraulic pump", lf: "Main pressure pump valve block 2" },
        { eq: "Hydraulic unit", it: "Hydraulic tank", lf: "Check hydraulic level" },
        { eq: "Hydraulic unit", it: "DCV valve block", lf: "Check oil leakages in line & valve block" },
        { eq: "Air circulation blower", it: "Bearing housing", lf: "Check bearing cooling line, oil level & unusual vibration" },
        { eq: "Plier", it: "Encoder & sensor", lf: "Check CAT 6A of encoder & tightness of proximity sensors" },
        { eq: "Loader", it: "Servo system", lf: "Movement speed and any unusual sound of servo system" },
        { eq: "Loader", it: "Cable carrier", lf: "Check cable carrier and cable damages" },
        { eq: "Loader", it: "IMI jacks", lf: "Air leakages and reed switch function of IMI jacks" }
      ]
    },
    {
      id: "ext-3", qr: "EXT-EXTRUDER", code: "03", name: "Extruder Main Press", doc: "CH/MT/102", plant: "EXTRUSION",
      items: [
        { eq: "Extruder", it: "Hydraulic oil temp", lf: "Normal maximum 140 F (60 C)" },
        { eq: "Extruder", it: "Oil level", lf: "Check oil level at starting and end position of ram" },
        { eq: "Extruder", it: "Oil leakages", lf: "Check connections and hoses" },
        { eq: "Extruder", it: "Shaft surfaces", lf: "Any surface damages/cracks on main and side cylinder shafts" },
        { eq: "Extruder", it: "Acoustics", lf: "Check unusual sound/noise during extrusion mode" },
        { eq: "Extruder", it: "Loader alignment", lf: "Check billet loader concentric center to container" },
        { eq: "Extruder", it: "Stem & container", lf: "Check stem alignment visually concentric with container" },
        { eq: "Extruder", it: "Side cylinder", lf: "Check oil leakages and bolt tightness" },
        { eq: "Extruder", it: "Side cylinder shaft", lf: "Check shaft cleanliness / clean nibs or dust" },
        { eq: "Extruder", it: "Main ram / pre-fill", lf: "Transducer pressure of pre-fill valve when closed" },
        { eq: "Extruder", it: "TEMPOSONIC transducer", lf: "Check tightness of cat6A and power cable" },
        { eq: "Extruder", it: "Main cylinder pressure", lf: "Check main cylinder pressure (MX2)" },
        { eq: "Extruder", it: "Main cylinder nuts", lf: "Check tightness of main cylinder nuts" },
        { eq: "Extruder", it: "Die slider jack", lf: "Check oil leakages of jack" },
        { eq: "Extruder", it: "CLIT transducer", lf: "Check CLIT transducer connection" },
        { eq: "Extruder", it: "Auto lubricator", lf: "Check air supply pressure and solenoid operation" },
        { eq: "Extruder", it: "Control cabinet", lf: "Check operation of electrical cabinet air conditioner" },
        { eq: "Extruder", it: "Container jack", lf: "Check oil leakages of jack shaft and visual surface" },
        { eq: "Extruder", it: "Container valves", lf: "Check oil leakages of related valve block (Item 22)" },
        { eq: "Extruder", it: "Container sealing", lf: "Container sealing pressure (MX1 Transducer)" },
        { eq: "Extruder", it: "Container backward", lf: "Container pressure when backward (MX2 Transducer)" },
        { eq: "Extruder", it: "Thermocouple wire", lf: "Check looseness of thermocouple connection and wire" }
      ]
    },
    {
      id: "ext-4", qr: "EXT-LEADOUT-HOTSAW", code: "04", name: "Lead Out Table & Hot Saw", doc: "CH/MT/102", plant: "EXTRUSION",
      items: [
        { eq: "Lead out table", it: "Hydraulic unit", lf: "Check hydraulic unit oil level and oil cooling process" },
        { eq: "Lead out table", it: "Run out movement", lf: "Check table up/down movement and limit sensor" },
        { eq: "Hot saw", it: "Power rail & collector", lf: "Check cleanness and correct movement in the rail" },
        { eq: "Hot saw", it: "Saw table operation", lf: "Check encoder alarming, running condition & movement" },
        { eq: "Hot saw", it: "LEUZE unit", lf: "Clean & check tightness of LEUZE communication cable" },
        { eq: "Hot saw", it: "Compressor", lf: "Check compressor operation and pressure" }
      ]
    },
    {
      id: "ext-5", qr: "EXT-PULLER-1-2", code: "05", name: "Puller 01 & Puller 02", doc: "CH/MT/102", plant: "EXTRUSION",
      items: [
        { eq: "Puller 01", it: "Servo & encoder", lf: "Check puller operation, movement and sound" },
        { eq: "Puller 01", it: "Puller bed", lf: "Check start/stop without unusual impact" },
        { eq: "Puller 01", it: "LEUZE unit", lf: "Clean & check cable tightness" },
        { eq: "Puller 01", it: "Power rail", lf: "Check cleanness and correct rail movement" },
        { eq: "Puller 01", it: "Hydraulic pressure", lf: "Check hydraulic pressure" },
        { eq: "Puller 01", it: "Hydraulic level", lf: "Check hydraulic oil level" },
        { eq: "Puller 01", it: "Hydraulic leaks", lf: "Check oil leakages from jack and valve block" },
        { eq: "Puller 02", it: "Servo & encoder", lf: "Check puller operation, movement and sound" },
        { eq: "Puller 02", it: "Puller bed", lf: "Check start/stop without unusual impact" },
        { eq: "Puller 02", it: "LEUZE unit", lf: "Clean & check cable tightness" },
        { eq: "Puller 02", it: "Power rail", lf: "Check cleanness and correct rail movement" },
        { eq: "Puller 02", it: "Hydraulic pressure", lf: "Check hydraulic pressure" },
        { eq: "Puller 02", it: "Hydraulic level", lf: "Check hydraulic oil level" },
        { eq: "Puller 02", it: "Hydraulic leaks", lf: "Check oil leakages from jack and valve block" }
      ]
    },
    {
      id: "ext-6", qr: "EXT-RUNOUT-TRANSFERS", code: "06", name: "Run Out Table & Transfers", doc: "CH/MT/102", plant: "EXTRUSION",
      items: [
        { eq: "Run out table", it: "Table bed", lf: "Check table up/down operation and proximity limit" },
        { eq: "K1 Transfer", it: "Shaft & motor", lf: "Check shaft connection and chain sprockets visually" },
        { eq: "K2 Transfer", it: "Shaft & motor", lf: "Check shaft connection and chain sprockets visually" },
        { eq: "K2 Transfer", it: "Pneumatic jacks", lf: "Check air leakages of all jacks" },
        { eq: "T3 Transfer", it: "Shaft & motor", lf: "Check shaft connection and chain sprockets visually" },
        { eq: "T4 Transfer", it: "Shaft & motor", lf: "Check shaft connection and chain sprockets visually" }
      ]
    },
    {
      id: "ext-7", qr: "EXT-STRETCHER-CUTTER", code: "07", name: "Stretcher & Second Cutter", doc: "CH/MT/102", plant: "EXTRUSION",
      items: [
        { eq: "Feeding table", it: "Chain & sprockets", lf: "Check damages and free rotation" },
        { eq: "Feeding table", it: "Table bed", lf: "Table up and down operation" },
        { eq: "Stretcher head", it: "Hydraulic unit", lf: "Check hydraulic level and pressure" },
        { eq: "Stretcher head", it: "Oil leakages", lf: "Check oil leakages" },
        { eq: "Stretcher head", it: "SICK DL 50", lf: "Check connection and inputs of SICK DL 50" },
        { eq: "Stretcher head", it: "Sensors", lf: "Check and tighten all sensor brackets and clamps" },
        { eq: "Stretcher tail stock", it: "Encoders", lf: "Check connection and encoder connections" },
        { eq: "Stretcher tail stock", it: "Hydraulic unit", lf: "Check hydraulic level and pressure" },
        { eq: "Stretcher tail stock", it: "Oil leakages", lf: "Check oil leakages" },
        { eq: "Stretcher tail stock", it: "Sensors", lf: "Check and tighten all sensor brackets and clamps" },
        { eq: "Second cutter", it: "Blade forward jacks", lf: "Check hydraulic operation" },
        { eq: "Second cutter", it: "Pneumatic jacks", lf: "Check air leakages of bed & stopper cylinder" },
        { eq: "Second cutter", it: "Stopper encoder", lf: "Check tightness of connections" },
        { eq: "Second cutter", it: "Sensors", lf: "Clean & check through beam and proximity sensors" }
      ]
    }
  ],
  vpc: [
    {
      id: "vpc-1", qr: "VPC-PRE-TREATMENT", code: "01", name: "Pre Treatment Tunnel", doc: "LS/MT/102", plant: "VPC",
      items: [
        { eq: "Pre Treatment Tunnel", it: "Pump 1 - Rinsing Tank", lf: "Pump motor vibration and sound" },
        { eq: "Pre Treatment Tunnel", it: "Pump 2 - Etching Bath 1", lf: "Pump motor vibration and sound" },
        { eq: "Pre Treatment Tunnel", it: "Heater 1 - Etching Bath 1", lf: "Check electrical power supply for heating element" },
        { eq: "Pre Treatment Tunnel", it: "Heater 2 - Etching Bath 1", lf: "Check electrical power supply for heating element" },
        { eq: "Pre Treatment Tunnel", it: "PVC pipes - Etching Bath 1", lf: "Leaks or any damages" },
        { eq: "Pre Treatment Tunnel", it: "Pump 3 - Etching Bath 2", lf: "Pump motor vibration and sound" },
        { eq: "Pre Treatment Tunnel", it: "Pump 4 - Etching Bath 2", lf: "Pump motor vibration and sound" },
        { eq: "Pre Treatment Tunnel", it: "Heater 3 - Etching Bath 2", lf: "Check electrical power supply for heating element" },
        { eq: "Pre Treatment Tunnel", it: "Heater 4 - Etching Bath 2", lf: "Check electrical power supply for heating element" },
        { eq: "Pre Treatment Tunnel", it: "PVC pipes - Etching Bath 2", lf: "Leaks or any damages" },
        { eq: "Pre Treatment Tunnel", it: "Pump 5 - Rinsing Tank", lf: "Pump motor vibration and sound" },
        { eq: "Pre Treatment Tunnel", it: "PVC pipes - Rinsing Tank", lf: "Leaks or any damages" },
        { eq: "Pre Treatment Tunnel", it: "Pump 6 - Rinsing Tank", lf: "Pump motor vibration and sound" },
        { eq: "Pre Treatment Tunnel", it: "PVC pipes - Rinsing Tank 2", lf: "Leaks or any damages" },
        { eq: "Pre Treatment Tunnel", it: "Pump 7 - DI Rinsing Tank", lf: "Pump motor vibration and sound" },
        { eq: "Pre Treatment Tunnel", it: "PVC pipes - DI Rinsing Tank", lf: "Leaks or any damages" },
        { eq: "Pre Treatment Tunnel", it: "Pump 8 - DI Rinsing Tank", lf: "Pump motor vibration and sound" },
        { eq: "Pre Treatment Tunnel", it: "PVC pipes - DI Rinsing Tank 2", lf: "Leaks or any damages" },
        { eq: "Pre Treatment Tunnel", it: "Pump 9 - Pure DI Tank", lf: "Pump motor vibration and sound" },
        { eq: "Pre Treatment Tunnel", it: "PVC pipes - Pure DI Tank", lf: "Leaks or any damages" },
        { eq: "Pre Treatment Tunnel", it: "Heater 5 - Conversion Bath", lf: "Check electrical power supply for heating element" },
        { eq: "Pre Treatment Tunnel", it: "Pump 10 - Conversion Bath", lf: "Operation of pump motor" },
        { eq: "Pre Treatment Tunnel", it: "Pipe pneumatic solenoid", lf: "Operation of solenoid valve" }
      ]
    },
    {
      id: "vpc-2", qr: "VPC-DRYING-OVEN", code: "02", name: "Drying Oven", doc: "LS/MT/102", plant: "VPC",
      items: [
        { eq: "Drying Oven", it: "Burner operation", lf: "Burner low flame, high flame, pause modes" },
        { eq: "Drying Oven", it: "Vibrations & noises", lf: "Vibrations and noises" },
        { eq: "Drying Oven", it: "Inlet gas pressure", lf: "Pressure Gauge 1 reading" },
        { eq: "Drying Oven", it: "mbar Gas pressure", lf: "Pressure Gauge 2 reading" },
        { eq: "Drying Oven", it: "Fuel leakages", lf: "LPG or Diesel leakages" },
        { eq: "Drying Oven", it: "Burner cleanliness", lf: "Cleanness of burner unit" },
        { eq: "Drying Oven", it: "Blower fan", lf: "Blower fan operation (sound or vibrations)" }
      ]
    },
    {
      id: "vpc-3", qr: "VPC-POWDER-BOOTH", code: "03", name: "Powder Booth", doc: "LS/MT/102", plant: "VPC",
      items: [
        { eq: "Powder Booth", it: "Wiper guide", lf: "Wiper guide clearance" },
        { eq: "Powder Booth", it: "Opti feeder pressure", lf: "Check Opti feeder set pressure" },
        { eq: "Powder Booth", it: "Vacuum gauge", lf: "Pressure Gauge Vacuum (2-4 bar)" },
        { eq: "Powder Booth", it: "Con. Air gauge", lf: "Pressure Gauge Con. Air (2-4 bar)" },
        { eq: "Powder Booth", it: "Pneumatic leaks", lf: "Check any pneumatic air leakages" },
        { eq: "Powder Booth", it: "Ultrasonic vibrator", lf: "Check error for ultrasonic vibrator" },
        { eq: "Powder Booth", it: "Opti Speeder sensor", lf: "Check level sensor operation" },
        { eq: "Powder Booth", it: "Aspiration motor", lf: "Check noise and vibration" },
        { eq: "Powder Booth", it: "Reciprocator motor", lf: "Check reciprocator motor & coupling" },
        { eq: "Powder Booth", it: "Reciprocator encoder", lf: "Check reciprocator encoder condition" },
        { eq: "Powder Booth", it: "Wiring condition", lf: "Check power and control wire damages" }
      ]
    },
    {
      id: "vpc-4", qr: "VPC-CURING-OVEN", code: "04", name: "Curing Oven", doc: "LS/MT/102", plant: "VPC",
      items: [
        { eq: "Curing Oven", it: "Burner operation", lf: "Low flame, high flame, pause modes" },
        { eq: "Curing Oven", it: "Vibrations & noises", lf: "Vibrations and noises" },
        { eq: "Curing Oven", it: "Inlet gas pressure", lf: "Pressure Gauge 1 reading" },
        { eq: "Curing Oven", it: "mbar Gas pressure", lf: "Pressure Gauge 2 reading" },
        { eq: "Curing Oven", it: "Fuel leakages", lf: "LPG or Diesel leakages" },
        { eq: "Curing Oven", it: "Burner cleanliness", lf: "Cleanness of burner" },
        { eq: "Curing Oven", it: "Blower fan", lf: "Blower fan operation (sound or vibration)" }
      ]
    },
    {
      id: "vpc-5", qr: "VPC-DISCENSORE-UNLOAD-CONVEYOR", code: "05", name: "Discensore, Unloading & Conveyor", doc: "LS/MT/102", plant: "VPC",
      items: [
        { eq: "Discensore", it: "Motor vibration", lf: "Check motor vibration and noise" },
        { eq: "Discensore", it: "Conveyor wobbling", lf: "Check wobbling of conveyor" },
        { eq: "Unloading table", it: "Motor & gear box", lf: "Check vibration of motor and gear box" },
        { eq: "Conveyor", it: "Lubricator oil", lf: "Check lubricator oil level" },
        { eq: "Conveyor", it: "Air pressure", lf: "Check air pressure for lubricator" }
      ]
    },
    {
      id: "vpc-6", qr: "VPC-DI-PLANT-HOOKS", code: "06", name: "DI Plant & Hooks Cleaning", doc: "LS/MT/102", plant: "VPC",
      items: [
        { eq: "DI Plant", it: "Air pressure", lf: "Check operating air pressure" },
        { eq: "DI Plant", it: "Water & air leaks", lf: "Check water and air leakages" },
        { eq: "DI Plant", it: "DI Pumps", lf: "Check pump vibrations and noises" },
        { eq: "Hooks & Filter press", it: "Sludge leaks", lf: "Check water, chemical and sludge leakages" },
        { eq: "Hooks & Filter press", it: "Hydraulic unit", lf: "Operation and hydraulic pressure" },
        { eq: "Hooks & Filter press", it: "Diaphragm pump", lf: "Visual condition / unusual noise or jerk" },
        { eq: "Hooks & Filter press", it: "Heater supply", lf: "Check power supply for heating element" },
        { eq: "Hooks & Filter press", it: "IR heater", lf: "IR heater operation and power check" },
        { eq: "Hooks & Filter press", it: "Washing nozzle", lf: "Hooks washing nozzle cleaning & operation" }
      ]
    }
  ]
};

async function main() {
  console.log("Seeding Database...");

  // Seed default users
  await prisma.user.upsert({
    where: { epf: "EPF-4820" },
    update: {},
    create: {
      epf: "EPF-4820",
      password: "tech123",
      role: "TECHNICIAN",
      name: "Floor Technician"
    }
  });

  await prisma.user.upsert({
    where: { epf: "admin" },
    update: {},
    create: {
      epf: "admin",
      password: "admin123",
      role: "SUPERVISOR",
      name: "Plant Supervisor / Admin"
    }
  });

  const allStations = [...MASTER_DATA.extrusion, ...MASTER_DATA.vpc];
  let totalChecks = 0;

  for (const st of allStations) {
    await prisma.station.upsert({
      where: { id: st.id },
      update: {
        code: st.code,
        name: st.name,
        plant: st.plant,
        docRef: st.doc,
        qrTag: st.qr
      },
      create: {
        id: st.id,
        code: st.code,
        name: st.name,
        plant: st.plant,
        docRef: st.doc,
        qrTag: st.qr
      }
    });

    for (let i = 0; i < st.items.length; i++) {
      const it = st.items[i];
      totalChecks++;
      
      const existing = await prisma.checkpoint.findFirst({
        where: {
          stationId: st.id,
          equipmentName: it.eq,
          itemName: it.it
        }
      });

      if (!existing) {
        await prisma.checkpoint.create({
          data: {
            stationId: st.id,
            equipmentName: it.eq,
            itemName: it.it,
            lookForCriteria: it.lf,
            orderIndex: i + 1
          }
        });
      }
    }
  }

  console.log(`Seed successfully completed: ${allStations.length} stations, ${totalChecks} master checkpoints seeded into SQLite!`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

