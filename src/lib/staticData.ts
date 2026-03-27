// Static intelligence data for map overlays

export type StrategicAsset = {
  id: string;
  name: string;
  type: 'base' | 'oil_field' | 'carrier' | 'chokepoint' | 'boat' | 'submarine';
  faction: 'us' | 'israel' | 'iran' | 'yemen' | 'neutral' | 'uk' | 'france' | 'turkey' | 'saudi' | 'uae' | 'qatar' | 'bahrain' | 'oman' | 'egypt' | 'jordan' | 'iraq' | 'russia' | 'china' | 'india';
  lat: number;
  lng: number;
  description: string;
  mmsi?: string;
  photoUrl?: string;
  country?: string; // ISO 2-letter code for flag display
};

export type HistoricalStrike = {
  id: string;
  targetName: string;
  attacker: 'israel' | 'iran' | 'us' | 'yemen' | 'unknown';
  lat: number;
  lng: number;
  date: string; // ISO string
  description: string;
};

export const STRATEGIC_ASSETS: StrategicAsset[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // UNITED STATES BASES
  // ═══════════════════════════════════════════════════════════════════════════
  { id: 'al-udeid', name: 'Al Udeid Air Base', type: 'base', faction: 'us', country: 'US', lat: 25.1186, lng: 51.3148, description: 'Forward headquarters of US Central Command (CENTCOM) in Qatar. Largest US air base in the Middle East, housing ~10,000 personnel. Combined Air Operations Center (CAOC) directs all coalition air operations across the region.' },
  { id: 'nsa-bahrain', name: 'NSA Bahrain / US 5th Fleet', type: 'base', faction: 'us', country: 'US', lat: 26.2056, lng: 50.6053, description: 'Headquarters for US Naval Forces Central Command and the US 5th Fleet. Controls naval operations across the Persian Gulf, Red Sea, and Arabian Sea. Key hub for anti-Houthi maritime operations.' },
  { id: 'al-asad', name: 'Al Asad Airbase', type: 'base', faction: 'us', country: 'US', lat: 33.7845, lng: 42.4384, description: 'Major US-operated airbase in Al Anbar Province, Iraq. Houses ~2,500 personnel. Targeted by Iranian ballistic missiles in Jan 2020 retaliation for Soleimani strike. Frequent target of Iranian proxy drone attacks.' },
  { id: 'muwaffaq-salti', name: 'Muwaffaq Salti Air Base', type: 'base', faction: 'us', country: 'US', lat: 31.8340, lng: 36.7865, description: 'Key US-Jordanian operations base near Azraq. Hosts USAF F-16s and MQ-9 Reapers. Primary launch point for strikes against ISIS and Iran-backed militia targets in Syria and Iraq.' },
  { id: 'camp-lemonnier', name: 'Camp Lemonnier', type: 'base', faction: 'us', country: 'US', lat: 11.5492, lng: 43.1481, description: 'Only permanent US military base in Africa, located in Djibouti. ~4,000 personnel. Critical for Red Sea/Bab el-Mandeb operations, counter-piracy, and Yemen strike missions. Hosts P-8A Poseidons and MQ-9 Reapers.' },
  { id: 'erbil-ab', name: 'Erbil Air Base', type: 'base', faction: 'us', country: 'US', lat: 36.2366, lng: 43.9631, description: 'US Coalition base in Kurdistan Region, Iraq. Frequent target of Iranian proxy ballistic missile and drone attacks. Houses special operations forces and intelligence assets.' },
  { id: 'al-dhafra', name: 'Al Dhafra Air Base', type: 'base', faction: 'us', country: 'US', lat: 24.2483, lng: 54.5475, description: 'US/UAE joint forces air base in Abu Dhabi. Hosts USAF F-22 Raptors, F-35s, KC-135 tankers, and RQ-4 Global Hawks. Primary ISR and air superiority hub for the Gulf region.' },
  { id: 'ali-al-salem', name: 'Ali Al Salem Air Base', type: 'base', faction: 'us', country: 'US', lat: 29.3466, lng: 47.5208, description: 'USAF base in Kuwait serving as the primary logistics and personnel transit hub for US forces entering/exiting the CENTCOM theater. ~13,000 rotational personnel.' },
  { id: 'tower-22', name: 'Tower 22 Outpost', type: 'base', faction: 'us', country: 'US', lat: 33.3218, lng: 38.6816, description: 'Remote logistics outpost near the Syria/Jordan/Iraq border. Three US soldiers killed in Jan 2024 Iranian proxy drone attack — the first US combat deaths in the region since the conflict escalation. Led to retaliatory US strikes on 85 targets.' },
  { id: 'camp-arifjan', name: 'Camp Arifjan', type: 'base', faction: 'us', country: 'US', lat: 29.0878, lng: 48.0907, description: 'US Army Central forward headquarters in Kuwait. Houses Third Army HQ and ~13,000 personnel. Primary ground forces command for the CENTCOM theater.' },
  { id: 'diego-garcia', name: 'Diego Garcia (NSF)', type: 'base', faction: 'us', country: 'US', lat: -7.3195, lng: 72.4229, description: 'Remote US naval support facility in the Indian Ocean. Key staging base for B-2 Spirit bombers. Used for long-range strikes into the Middle East. Hosts pre-positioned equipment ships.' },
  { id: 'incirlik', name: 'Incirlik Air Base', type: 'base', faction: 'us', country: 'US', lat: 37.0021, lng: 35.4259, description: 'Major US/NATO air base in southern Turkey. Hosts ~5,000 US personnel and ~50 B61 nuclear gravity bombs. Strategic for operations in Syria, Iraq, and the Eastern Mediterranean.' },
  { id: 'souda-bay', name: 'NSA Souda Bay', type: 'base', faction: 'us', country: 'US', lat: 35.4847, lng: 24.1188, description: 'US Naval Support Activity in Crete, Greece. Critical logistics hub for US 6th Fleet. Supports Mediterranean and Eastern Med operations. Deep-water port and airfield.' },

  // ═══════════════════════════════════════════════════════════════════════════
  // UNITED KINGDOM BASES
  // ═══════════════════════════════════════════════════════════════════════════
  { id: 'raf-akrotiri', name: 'RAF Akrotiri', type: 'base', faction: 'uk', country: 'GB', lat: 34.5904, lng: 32.9879, description: 'British Sovereign Base Area in Cyprus. Hosts RAF Typhoon fighters, tankers, and surveillance aircraft. Used for strikes against ISIS and Houthi targets. Key staging base for Eastern Mediterranean operations.' },
  { id: 'bm-duqm', name: 'British Maritime Facility Duqm', type: 'base', faction: 'uk', country: 'GB', lat: 19.6735, lng: 57.7034, description: 'UK joint logistics support base in Oman. Expanded in 2024 to support carrier operations in the Indian Ocean. Can berth Queen Elizabeth-class carriers. Supports anti-Houthi operations.' },
  { id: 'uk-bahrain', name: 'HMS Juffair (UK NSF)', type: 'base', faction: 'uk', country: 'GB', lat: 26.2224, lng: 50.5872, description: 'UK Naval Support Facility in Bahrain, opened 2018. Permanent base for Royal Navy in the Gulf. Supports mine countermeasure and patrol vessels. Co-located near US 5th Fleet HQ.' },

  // ═══════════════════════════════════════════════════════════════════════════
  // FRANCE BASES
  // ═══════════════════════════════════════════════════════════════════════════
  { id: 'fr-djibouti', name: 'FFDj — French Forces Djibouti', type: 'base', faction: 'france', country: 'FR', lat: 11.5600, lng: 43.1500, description: 'Largest French military base abroad with ~1,500 personnel. Hosts Mirage 2000 fighters and Atlantique 2 maritime patrol aircraft. Supports anti-piracy and Red Sea operations. Adjacent to US Camp Lemonnier.' },
  { id: 'fr-abudhabi', name: 'French Naval Base Abu Dhabi', type: 'base', faction: 'france', country: 'FR', lat: 24.5356, lng: 54.6526, description: 'Permanent French military installation in the UAE, established 2009. ~700 personnel. Hosts Rafale fighters, a naval component, and armored vehicles. France\'s first permanent base in the Persian Gulf.' },
  { id: 'fr-reunion', name: 'FAZSOI — French Forces Réunion', type: 'base', faction: 'france', country: 'FR', lat: -20.8789, lng: 55.4481, description: 'French Southern Indian Ocean command. Hosts naval patrol and surveillance assets. Supports freedom of navigation operations and disaster response across the Indian Ocean.' },

  // ═══════════════════════════════════════════════════════════════════════════
  // TURKEY BASES
  // ═══════════════════════════════════════════════════════════════════════════
  { id: 'tr-bashiqa', name: 'Bashiqa Camp', type: 'base', faction: 'turkey', country: 'TR', lat: 36.4397, lng: 43.4622, description: 'Turkish military camp near Mosul in northern Iraq. Houses ~2,000 Turkish troops training Kurdish Peshmerga and Sunni fighters. Controversial presence disputed by Iraqi government.' },
  { id: 'tr-qatar', name: 'Turkish Base Qatar', type: 'base', faction: 'turkey', country: 'TR', lat: 25.2700, lng: 51.5650, description: 'Turkish military base in Qatar, established 2015. Houses ~5,000 troops. Deployed rapidly during the 2017 Qatar diplomatic crisis. Turkey\'s largest overseas military base.' },
  { id: 'tr-mogadishu', name: 'TURKSOM — Mogadishu', type: 'base', faction: 'turkey', country: 'TR', lat: 2.0469, lng: 45.3182, description: 'Turkey\'s largest overseas military training facility in Somalia. Trains Somali National Army soldiers. Part of Turkey\'s expanding military footprint in East Africa and the Horn.' },
  { id: 'tr-hataySE', name: 'Hatay / Reyhanlı Border Base', type: 'base', faction: 'turkey', country: 'TR', lat: 36.2674, lng: 36.5673, description: 'Major Turkish military staging area on the Syrian border. Supports Operation Euphrates Shield and cross-border operations. Houses artillery, armor, and forward-deployed infantry.' },

  // ═══════════════════════════════════════════════════════════════════════════
  // ISRAEL BASES
  // ═══════════════════════════════════════════════════════════════════════════
  { id: 'nevatim', name: 'Nevatim Airbase', type: 'base', faction: 'israel', country: 'IL', lat: 31.2069, lng: 35.0118, description: 'Primary IAF F-35I "Adir" fighter base in the Negev desert. Directly targeted by Iranian ballistic missiles in April 2024. Houses Israel\'s most advanced stealth fighters and strategic airlift capabilities.' },
  { id: 'tel-nof', name: 'Tel Nof Base', type: 'base', faction: 'israel', country: 'IL', lat: 31.8398, lng: 34.8239, description: 'Key IAF base housing 69 Squadron ("The Hammers") F-15I Ra\'am. Historically used for long-range strategic strike missions. Also houses Arrow-3 ballistic missile defense batteries.' },
  { id: 'ramat-david', name: 'Ramat David Airbase', type: 'base', faction: 'israel', country: 'IL', lat: 32.6653, lng: 35.1794, description: 'Northernmost IAF primary base. Key for operations against Hezbollah in Lebanon. Houses F-16I Sufa squadrons and Iron Dome batteries protecting northern Israel.' },
  { id: 'palmachim', name: 'Palmachim Air Base', type: 'base', faction: 'israel', country: 'IL', lat: 31.8974, lng: 34.6906, description: 'Israeli missile test and satellite launch facility on the Mediterranean coast. Launch site for Shavit space launch vehicle and Jericho ICBM tests. Houses Arrow and David\'s Sling interceptors.' },
  { id: 'hatzerim', name: 'Hatzerim Airbase', type: 'base', faction: 'israel', country: 'IL', lat: 31.2341, lng: 34.6627, description: 'IAF flight academy and operational fighter base in the Negev. Houses F-16 squadrons and the IAF Aerobatic Team. Also serves as reserve base for strategic surge operations.' },
  { id: 'ramon', name: 'Ramon Airbase', type: 'base', faction: 'israel', country: 'IL', lat: 30.7761, lng: 34.6667, description: 'Southernmost IAF base near Eilat. Strategic location for Red Sea operations and strikes toward Yemen/Sudan. Expanded runway can handle heavy bombers and strategic transport aircraft.' },

  // ═══════════════════════════════════════════════════════════════════════════
  // IRAN BASES & NUCLEAR FACILITIES
  // ═══════════════════════════════════════════════════════════════════════════
  { id: 'kharg-island', name: 'Kharg Island Oil Terminal', type: 'oil_field', faction: 'iran', country: 'IR', lat: 29.2389, lng: 50.3168, description: 'Handles ~90% of Iranian oil exports. Critical economic lifeline generating most of Iran\'s foreign revenue. Protected by IRGC Navy and air defense systems. Would be a primary target in any major escalation.' },
  { id: 'abadan-refinery', name: 'Abadan Oil Refinery', type: 'oil_field', faction: 'iran', country: 'IR', lat: 30.3444, lng: 48.2831, description: 'Major oil processing facility near the Iraqi border. Once the world\'s largest refinery. Key infrastructure for domestic fuel supply. Located in militarily vulnerable position near the border.' },
  { id: 'fordow', name: 'Fordow Enrichment Plant', type: 'base', faction: 'iran', country: 'IR', lat: 34.8841, lng: 50.9959, description: 'Underground uranium enrichment facility buried deep inside a mountain near Qom. Enriching to 60% U-235 as of 2024. Hardened against airstrikes. Considered the most difficult Iranian nuclear target to destroy.' },
  { id: 'natanz', name: 'Natanz Nuclear Facility', type: 'base', faction: 'iran', country: 'IR', lat: 33.7258, lng: 51.7289, description: 'Primary Iranian uranium enrichment center. Target of the Stuxnet cyberattack (2010) and multiple sabotage operations. Underground halls house thousands of centrifuges. Enriching to 60% U-235.' },
  { id: 'khatam-al-anbiya', name: 'Khatam al-Anbiya HQ', type: 'base', faction: 'iran', country: 'IR', lat: 35.6961, lng: 51.4231, description: 'Air Defense Headquarters in Tehran. Commands Iran\'s integrated air defense network including S-300, Bavar-373, and Khordad-15 systems. Primary command node for Iranian aerospace defense.' },
  { id: 'isfahan-nf', name: 'Isfahan Nuclear Technology Center', type: 'base', faction: 'iran', country: 'IR', lat: 32.6400, lng: 51.6700, description: 'Uranium conversion facility (UCF) that converts yellowcake to UF6 feedstock for enrichment. Also houses the Miniature Neutron Source Reactor. Targeted by Israeli drone strike in Feb 2024.' },
  { id: 'parchin', name: 'Parchin Military Complex', type: 'base', faction: 'iran', country: 'IR', lat: 35.5333, lng: 51.7667, description: 'Massive military-industrial complex southeast of Tehran. Suspected site of nuclear weapons-related high-explosive testing. IAEA repeatedly denied access. Houses missile production and testing facilities.' },
  { id: 'bandar-abbas', name: 'Bandar Abbas Naval Base', type: 'base', faction: 'iran', country: 'IR', lat: 27.1832, lng: 56.2666, description: 'Main base of IRIN (Iranian Navy) and IRGC Navy. Controls the Strait of Hormuz. Houses fast attack craft, submarines, and anti-ship missile batteries. Key for Iranian maritime denial strategy.' },
  { id: 'bushehr', name: 'Bushehr Nuclear Power Plant', type: 'base', faction: 'iran', country: 'IR', lat: 28.8324, lng: 50.8843, description: 'Iran\'s only operational nuclear power plant, built with Russian assistance. 1,000 MW capacity. Russian-supplied fuel rods theoretically limit weapons proliferation, but facility represents significant nuclear infrastructure.' },
  { id: 'tabriz-ab', name: 'Tabriz Air Base', type: 'base', faction: 'iran', country: 'IR', lat: 38.1340, lng: 46.2350, description: 'Major IRIAF (Iranian Air Force) base in northwest Iran near the Turkish and Azerbaijani borders. Houses F-14 Tomcat interceptors and Su-24 Fencer strike aircraft. First-line defense against threats from the north.' },

  // ═══════════════════════════════════════════════════════════════════════════
  // SAUDI ARABIA BASES
  // ═══════════════════════════════════════════════════════════════════════════
  { id: 'ksa-psab', name: 'Prince Sultan Air Base', type: 'base', faction: 'saudi', country: 'SA', lat: 24.0627, lng: 47.5805, description: 'Major Saudi/US air base south of Riyadh. Houses USAF Patriot batteries, F-15E Strike Eagles, and THAAD missile defense. Reactivated in 2019 after 16-year hiatus due to Iranian threat escalation.' },
  { id: 'ksa-dhahran', name: 'King Abdulaziz Air Base', type: 'base', faction: 'saudi', country: 'SA', lat: 26.2654, lng: 50.1527, description: 'Primary RSAF (Royal Saudi Air Force) base in the Eastern Province. Houses F-15SA Advanced Eagles. Targeted by Houthi missiles and drones. Critical for Persian Gulf air defense.' },
  { id: 'ksa-khamis', name: 'King Khalid Air Base', type: 'base', faction: 'saudi', country: 'SA', lat: 18.2973, lng: 42.8037, description: 'Major southern Saudi air base near the Yemeni border. Frontline base for the Saudi-led coalition air campaign in Yemen. Houses F-15s, Tornados, and Typhoons. Frequent Houthi missile target.' },
  { id: 'ksa-tabuk', name: 'King Faisal Air Base (Tabuk)', type: 'base', faction: 'saudi', country: 'SA', lat: 28.3652, lng: 36.6189, description: 'Northwestern Saudi air base near Jordan and the Red Sea. Houses RSAF F-15 and Tornado squadrons. Strategic location for Red Sea operations and defense of NEOM megaproject region.' },
  { id: 'ksa-yanbu', name: 'King Fahd Naval Base Yanbu', type: 'base', faction: 'saudi', country: 'SA', lat: 24.0833, lng: 38.0667, description: 'Royal Saudi Navy western fleet headquarters on the Red Sea. Houses frigates, corvettes, and patrol craft. Key for Red Sea mine clearance and anti-Houthi maritime operations.' },

  // ═══════════════════════════════════════════════════════════════════════════
  // UAE BASES
  // ═══════════════════════════════════════════════════════════════════════════
  { id: 'uae-minhad', name: 'Minhad Air Base', type: 'base', faction: 'uae', country: 'AE', lat: 25.0279, lng: 55.3660, description: 'Major UAE Air Force base near Dubai. Also hosts coalition partner forces including Australian and Canadian aircraft. Supports operations in Yemen and the broader region. Houses Mirage 2000s and F-16E Block 60s.' },
  { id: 'uae-sweihan', name: 'Al Ain / Sweihan Air Base', type: 'base', faction: 'uae', country: 'AE', lat: 24.2613, lng: 55.7935, description: 'UAE strategic air base near the Omani border. Houses advanced UAE Air Force assets and serves as an alternative operations base for US forces when Al Dhafra is at capacity.' },

  // ═══════════════════════════════════════════════════════════════════════════
  // EGYPT BASES
  // ═══════════════════════════════════════════════════════════════════════════
  { id: 'eg-berenice', name: 'Berenice Military Base', type: 'base', faction: 'egypt', country: 'EG', lat: 23.9500, lng: 35.4833, description: 'Egypt\'s newest and southernmost Red Sea military base, opened 2020. Houses naval vessels, aircraft, and special forces. Strategic location for monitoring Red Sea shipping lanes and Bab el-Mandeb approaches.' },
  { id: 'eg-cairo-west', name: 'Cairo West Air Base', type: 'base', faction: 'egypt', country: 'EG', lat: 30.1164, lng: 30.9153, description: 'Major Egyptian Air Force base west of Cairo. Houses F-16, Mirage 2000, and Rafale fighters. Primary air defense base for the Egyptian capital and Suez Canal northern approaches.' },
  { id: 'eg-borg-el-arab', name: 'Borg el-Arab Air Base', type: 'base', faction: 'egypt', country: 'EG', lat: 30.9210, lng: 29.6910, description: 'Egyptian Air Force base near Alexandria on the Mediterranean coast. Houses Su-35 fighters recently acquired from Russia. Key for Mediterranean and North African air operations.' },

  // ═══════════════════════════════════════════════════════════════════════════
  // JORDAN BASES
  // ═══════════════════════════════════════════════════════════════════════════
  { id: 'jo-shaheed', name: 'Shaheed Muwaffaq Air Base', type: 'base', faction: 'jordan', country: 'JO', lat: 32.3564, lng: 36.2592, description: 'Royal Jordanian Air Force headquarters near Azraq. Houses RJAF F-16s. US forces use nearby facilities for special operations and border security. Jordan is a key US ally for Syria/Iraq operations.' },

  // ═══════════════════════════════════════════════════════════════════════════
  // IRAQ BASES
  // ═══════════════════════════════════════════════════════════════════════════
  { id: 'iq-balad', name: 'Balad Air Base (Al Bakr)', type: 'base', faction: 'iraq', country: 'IQ', lat: 33.9402, lng: 44.3615, description: 'Former major US base, now Iraqi Air Force HQ. Houses F-16IQ fighters and T-50 trainers. Frequent target of Iranian proxy militia rocket attacks. Iranian-backed PMF forces operate nearby.' },
  { id: 'iq-taji', name: 'Camp Taji', type: 'base', faction: 'iraq', country: 'IQ', lat: 33.5333, lng: 44.2617, description: 'Major Iraqi Army base north of Baghdad. Former US/Coalition training facility. Houses Iraqi armored units and helicopter squadrons. Targeted repeatedly by Kata\'ib Hezbollah rockets.' },

  // ═══════════════════════════════════════════════════════════════════════════
  // RUSSIA BASES
  // ═══════════════════════════════════════════════════════════════════════════
  { id: 'ru-hmeimim', name: 'Hmeimim Air Base', type: 'base', faction: 'russia', country: 'RU', lat: 35.4012, lng: 35.9487, description: 'Primary Russian military air base in Syria (Latakia). Houses Su-35S, Su-34, and Su-57 fighters. Russia\'s main power projection platform in the Mediterranean. Over 60,000 sorties flown since 2015 Syrian intervention.' },
  { id: 'ru-tartus', name: 'Naval Facility Tartus', type: 'base', faction: 'russia', country: 'RU', lat: 34.8868, lng: 35.8867, description: 'Russia\'s only Mediterranean naval base, located in Syria. Supports Russian Navy operations and submarine deployments. Expanded to handle larger vessels. Critical for sustaining Russian military presence in the region.' },

  // ═══════════════════════════════════════════════════════════════════════════
  // CHINA BASES
  // ═══════════════════════════════════════════════════════════════════════════
  { id: 'cn-djibouti', name: 'PLA Support Base Djibouti', type: 'base', faction: 'china', country: 'CN', lat: 11.5897, lng: 43.0830, description: 'China\'s first overseas military base, established 2017 in Djibouti. Houses ~2,000 PLA personnel. Supports Chinese Navy anti-piracy patrols and Indian Ocean operations. Located near US, French, and Japanese bases.' },

  // ═══════════════════════════════════════════════════════════════════════════
  // INDIA BASES (Regional Presence)
  // ═══════════════════════════════════════════════════════════════════════════
  { id: 'in-duqm', name: 'Indian Naval Facility Duqm', type: 'base', faction: 'india', country: 'IN', lat: 19.6603, lng: 57.6856, description: 'Indian Navy access agreement at Oman\'s Duqm port. Supports Indian naval deployments in the Arabian Sea. India maintains a growing naval presence to protect shipping lanes and counter Chinese influence.' },

  // ═══════════════════════════════════════════════════════════════════════════
  // CHOKEPOINTS
  // ═══════════════════════════════════════════════════════════════════════════
  { id: 'bab-el-mandeb', name: 'Bab el-Mandeb Strait', type: 'chokepoint', faction: 'yemen', country: 'YE', lat: 12.5833, lng: 43.3333, description: 'Critical maritime chokepoint connecting the Red Sea to the Gulf of Aden. ~6.2 million barrels of oil transit daily. Under de facto Houthi threat since Nov 2023. Major shipping lines rerouted around Africa, adding 10-14 days transit.' },
  { id: 'strait-of-hormuz', name: 'Strait of Hormuz', type: 'chokepoint', faction: 'iran', country: 'IR', lat: 26.5667, lng: 56.2500, description: 'World\'s most important oil transit chokepoint. ~21 million barrels/day (~21% of global consumption) flow through this 21-mile-wide passage. Iran has repeatedly threatened to close it. IRGC Navy fast boats patrol extensively.' },
  { id: 'suez-canal', name: 'Suez Canal', type: 'chokepoint', faction: 'egypt', country: 'EG', lat: 29.9328, lng: 32.5594, description: 'Global maritime choke point handling ~12% of world trade. Revenue dropped ~50% since Houthi Red Sea attacks forced ships to reroute around the Cape of Good Hope. Egypt loses ~$500M/month in transit fees.' },

  // ═══════════════════════════════════════════════════════════════════════════
  // US NAVY VESSELS
  // ═══════════════════════════════════════════════════════════════════════════
  { id: 'cvn-72', name: 'USS Abraham Lincoln (CVN-72)', type: 'carrier', faction: 'us', country: 'US', lat: 16.5, lng: 54.5, mmsi: '338827000', description: 'Nimitz-class aircraft carrier. Carrier Strike Group 3, deployed to Arabian Sea. 90 aircraft, 5,500 crew. Provides air superiority and strike capability for CENTCOM operations.' },
  { id: 'cvn-78', name: 'USS Gerald R. Ford (CVN-78)', type: 'carrier', faction: 'us', country: 'US', lat: 21.5, lng: 38.0, mmsi: '338945000', description: 'Lead ship of the Ford-class, most advanced carrier ever built. EMALS catapults, 75+ aircraft. Deployed to Red Sea for Operation Epic Fury against Houthi targets. 4,500 crew.' },
  { id: 'ddg-117', name: 'USS Paul Ignatius (DDG-117)', type: 'boat', faction: 'us', country: 'US', lat: 15.2, lng: 42.1, description: 'Arleigh Burke-class guided-missile destroyer. Assigned to USS Ford CSG. Shot down multiple Houthi drones and anti-ship ballistic missiles in Red Sea. Aegis combat system.' },
  { id: 'ddg-114', name: 'USS Ralph Johnson (DDG-114)', type: 'boat', faction: 'us', country: 'US', lat: 13.8, lng: 47.5, description: 'Arleigh Burke-class destroyer operating in Gulf of Aden. Part of anti-Houthi maritime coalition. Equipped with SM-2, SM-6, and Tomahawk missiles.' },
  { id: 'lhd-4', name: 'USS Boxer (LHD-4)', type: 'boat', faction: 'us', country: 'US', lat: 13.5, lng: 48.0, mmsi: '369408000', description: 'Wasp-class amphibious assault ship. Deploys with 15th MEU (Marine Expeditionary Unit). Carries AV-8B Harriers, CH-53E helicopters, and 2,200 Marines. Operating in Gulf of Aden.' },
  { id: 'cg-59', name: 'USS Princeton (CG-59)', type: 'boat', faction: 'us', country: 'US', lat: 26.8, lng: 51.2, description: 'Ticonderoga-class guided-missile cruiser operating in the Persian Gulf. 122 VLS cells for SM-2/SM-6 and Tomahawk missiles. Provides fleet air defense and Aegis BMD capability.' },
  // ═══════════════════════════════════════════════════════════════════════════
  // SUBMARINES (positions are approximate — submarines operate covertly)
  // ═══════════════════════════════════════════════════════════════════════════
  { id: 'ssn-788', name: 'USS Colorado (SSN-788)', type: 'submarine', faction: 'us', country: 'US', lat: 25.5, lng: 57.0, description: 'Virginia-class fast-attack submarine (Block III). Operates covertly in the Arabian Sea and Persian Gulf. 12 VLS cells for Tomahawk cruise missiles, Mk48 ADCAP torpedoes. ISR and SOF capable.' },
  { id: 'ssgn-728', name: 'USS Florida (SSGN-728)', type: 'submarine', faction: 'us', country: 'US', lat: 14.0, lng: 43.5, photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/USS_Florida_%28SSGN-728%29.jpg/500px-USS_Florida_%28SSGN-728%29.jpg', description: 'Ohio-class guided-missile submarine (converted SSBN). Carries 154 Tomahawk cruise missiles — more than any other vessel. Deployed to Red Sea / Gulf of Aden. Can insert 66 Navy SEALs. Surfaced publicly near Suez in 2024 as deterrence signal.' },
  { id: 'ssn-800', name: 'USS Arkansas (SSN-800)', type: 'submarine', faction: 'us', country: 'US', lat: 26.2, lng: 52.5, description: 'Virginia-class Block IV fast-attack submarine. Deployed to Persian Gulf for ISR and deterrence patrol. Enhanced Virginia Payload Module planned for Block V. Quietest US attack submarine class.' },
  { id: 'hms-astute', name: 'HMS Astute (S119)', type: 'submarine', faction: 'uk', country: 'GB', lat: 33.0, lng: 33.5, description: 'Astute-class nuclear attack submarine. Royal Navy\'s most advanced SSN. Tomahawk cruise missiles and Spearfish torpedoes. Deployed to Eastern Mediterranean. Sonar reportedly can detect ships 3,000 miles away.' },
  { id: 'fs-suffren', name: 'FS Suffren (S635)', type: 'submarine', faction: 'france', country: 'FR', lat: 34.0, lng: 34.0, description: 'Barracuda-class nuclear attack submarine (SSN). France\'s newest submarine class, entered service 2022. MdCN naval cruise missiles and Exocet anti-ship missiles. Deployed for Mediterranean deterrence.' },
  { id: 'ir-fateh', name: 'IRIS Fateh submarine', type: 'submarine', faction: 'iran', country: 'IR', lat: 27.2, lng: 55.8, description: 'Fateh-class semi-heavy submarine. Iran\'s largest domestically-built submarine. Displaces ~600 tonnes. Can launch torpedoes and mines. Patrols the Strait of Hormuz as part of Iran\'s A2/AD strategy.' },
  { id: 'ir-ghadir', name: 'Ghadir-class submarine', type: 'submarine', faction: 'iran', country: 'IR', lat: 26.5, lng: 56.0, description: 'Iran operates 20+ Ghadir-class midget submarines. 120-tonne displacement, 2 torpedo tubes. Designed for shallow-water guerrilla warfare in the Persian Gulf. Can lay mines and deliver special forces.' },
  { id: 'in-arihant', name: 'INS Arihant (S2)', type: 'submarine', faction: 'india', country: 'IN', lat: 13.0, lng: 60.0, description: 'Arihant-class nuclear ballistic missile submarine (SSBN). India\'s sea-based nuclear deterrent. K-15 Sagarika SLBMs. Typically patrols the Arabian Sea. Part of India\'s nuclear triad.' },
  { id: 'ru-kazan', name: 'Kazan submarine K-561', type: 'submarine', faction: 'russia', country: 'RU', lat: 16.0, lng: 56.0, description: 'Yasen-M class nuclear attack submarine (SSGN). Russia\'s most advanced submarine. Carries Kalibr and Oniks cruise missiles + Zircon hypersonic missiles. Deployed to Indian Ocean for long-range patrols.' },
  { id: 'cn-093', name: 'Type 093 Shang-class submarine', type: 'submarine', faction: 'china', country: 'CN', lat: 10.0, lng: 64.0, description: 'Type 093A nuclear attack submarine. PLAN\'s primary SSN for blue-water operations. YJ-18 anti-ship cruise missiles. Accompanies PLAN task forces through the Indian Ocean to Djibouti base.' },

  // ═══════════════════════════════════════════════════════════════════════════
  // ROYAL NAVY (UK)
  // ═══════════════════════════════════════════════════════════════════════════
  { id: 'r08', name: 'HMS Queen Elizabeth (R08)', type: 'carrier', faction: 'uk', country: 'GB', lat: 34.2, lng: 32.5, photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/81/HMS_Queen_Elizabeth_in_Gibraltar_-_2018_%2828386226189%29.jpg/500px-HMS_Queen_Elizabeth_in_Gibraltar_-_2018_%2828386226189%29.jpg', description: 'Queen Elizabeth-class aircraft carrier, 65,000 tonnes. Flagship of the Royal Navy. Carries F-35B Lightning II and Merlin helicopters. Deployed to Eastern Mediterranean for NATO exercises.' },
  { id: 'hms-diamond', name: 'HMS Diamond (D34)', type: 'boat', faction: 'uk', country: 'GB', lat: 14.5, lng: 42.8, photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/HMS_Diamond_1.jpg/500px-HMS_Diamond_1.jpg', description: 'Type 45 Daring-class destroyer. Deployed to Red Sea as part of Operation Prosperity Guardian. Shot down multiple Houthi drones. Sea Viper air defense system.' },
  { id: 'hms-lancaster', name: 'HMS Lancaster (F229)', type: 'boat', faction: 'uk', country: 'GB', lat: 26.0, lng: 51.0, description: 'Type 23 Duke-class frigate on Gulf patrol. Anti-submarine and general purpose warfare. Assigned to the UK Maritime Component Command in Bahrain.' },

  // ═══════════════════════════════════════════════════════════════════════════
  // FRENCH NAVY (MARINE NATIONALE)
  // ═══════════════════════════════════════════════════════════════════════════
  { id: 'r91', name: 'FS Charles de Gaulle (R91)', type: 'carrier', faction: 'france', country: 'FR', lat: 33.5, lng: 33.0, description: 'France\'s only nuclear-powered aircraft carrier, 42,000 tonnes. Carries Rafale M fighters and E-2C Hawkeye. Regular deployments to Eastern Mediterranean in support of operations in the Levant.' },
  { id: 'fs-alsace', name: 'FS Alsace (D656)', type: 'boat', faction: 'france', country: 'FR', lat: 12.8, lng: 44.0, description: 'FREMM-class air defense frigate. Deployed to Red Sea / Gulf of Aden for anti-Houthi operations under French Task Force 473. Aster-15/30 missiles.' },

  // ═══════════════════════════════════════════════════════════════════════════
  // INDIAN NAVY
  // ═══════════════════════════════════════════════════════════════════════════
  { id: 'ins-vikrant', name: 'INS Vikrant (R11)', type: 'carrier', faction: 'india', country: 'IN', lat: 15.0, lng: 62.0, description: 'India\'s first indigenous aircraft carrier, 45,000 tonnes. Commissioned 2022. Carries MiG-29K fighters. Deployed to Arabian Sea for exercises and maritime domain awareness. India\'s growing blue-water capability.' },
  { id: 'ins-kolkata', name: 'INS Kolkata (D63)', type: 'boat', faction: 'india', country: 'IN', lat: 14.5, lng: 59.0, photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/39/201117-N-NC885-1128_%28cropped%29.jpg/500px-201117-N-NC885-1128_%28cropped%29.jpg', description: 'Kolkata-class stealth destroyer, India\'s most advanced surface combatant. BrahMos anti-ship missiles. Patrols Arabian Sea shipping lanes against piracy and ensures freedom of navigation.' },

  // ═══════════════════════════════════════════════════════════════════════════
  // RUSSIAN NAVY
  // ═══════════════════════════════════════════════════════════════════════════
  { id: 'ru-kuznetsov', name: 'Admiral Kuznetsov aircraft carrier', type: 'carrier', faction: 'russia', country: 'RU', lat: 34.7, lng: 35.7, description: 'Russia\'s only aircraft carrier (technically heavy aircraft cruiser), 55,000 tonnes. Previously deployed to Eastern Mediterranean to support Syrian operations. Currently undergoing extended refit at Murmansk, return uncertain.' },
  { id: 'ru-frigate', name: 'Admiral Gorshkov frigate', type: 'boat', faction: 'russia', country: 'RU', lat: 15.5, lng: 55.5, photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d7/Admiral_Gorshkov_frigate_05.jpg/500px-Admiral_Gorshkov_frigate_05.jpg', description: 'Project 22350 guided-missile frigate. Armed with Zircon hypersonic anti-ship missiles (Mach 8+). Deployed to Indian Ocean as part of Russia\'s long-range naval presence. First combat use of Zircon reported.' },

  // ═══════════════════════════════════════════════════════════════════════════
  // CHINESE NAVY (PLAN)
  // ═══════════════════════════════════════════════════════════════════════════
  { id: 'cn-liaoning', name: 'Liaoning aircraft carrier CV-16', type: 'carrier', faction: 'china', country: 'CN', lat: 10.5, lng: 65.0, photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/76/Aircraft_Carrier_Liaoning_CV-16.jpg/500px-Aircraft_Carrier_Liaoning_CV-16.jpg', description: 'China\'s first aircraft carrier, 60,000 tonnes (refitted ex-Soviet Varyag). J-15 fighters. PLAN deploys anti-piracy task forces through the Indian Ocean regularly. China\'s growing interest in Gulf security.' },
  { id: 'cn-052d', name: 'PLANS Nanning destroyer', type: 'boat', faction: 'china', country: 'CN', lat: 11.2, lng: 44.5, description: 'Type 052D Luyang III-class destroyer. Part of PLAN anti-piracy task forces that rotate through the Gulf of Aden. HHQ-9 air defense missiles. Regularly ports at Djibouti base.' },

  // ═══════════════════════════════════════════════════════════════════════════
  // IRANIAN NAVY (IRIN + IRGCN)
  // ═══════════════════════════════════════════════════════════════════════════
  { id: 'iris-sahand', name: 'IRIS Sahand warship', type: 'boat', faction: 'iran', country: 'IR', lat: 27.0, lng: 56.8, description: 'Moudge-class frigate (indigenous). Iran\'s most capable surface combatant. Anti-ship missiles, torpedo tubes, helicopter deck. Patrols Strait of Hormuz. Part of Iran\'s "strategic navy" deterrent.' },
  { id: 'irgcn-fast', name: 'IRGC Navy fast attack craft', type: 'boat', faction: 'iran', country: 'IR', lat: 26.8, lng: 55.5, description: 'IRGC Navy operates 1,500+ fast attack craft armed with anti-ship missiles, rockets, and mines. Swarm tactics doctrine designed to overwhelm larger navies. Primary Strait of Hormuz denial force.' },

  // ═══════════════════════════════════════════════════════════════════════════
  // SAUDI NAVY (RSNF)
  // ═══════════════════════════════════════════════════════════════════════════
  { id: 'ksa-makkah', name: 'Al Riyadh class frigate Saudi Navy', type: 'boat', faction: 'saudi', country: 'SA', lat: 20.5, lng: 39.5, description: 'Al Riyadh-class frigate (French La Fayette design). Saudi Navy\'s most capable surface combatant. Armed with Otomat Mk2 anti-ship missiles. Patrols Red Sea against Houthi maritime threats.' },

  // ═══════════════════════════════════════════════════════════════════════════
  // TURKISH NAVY
  // ═══════════════════════════════════════════════════════════════════════════
  { id: 'tcg-anadolu', name: 'TCG Anadolu (L400)', type: 'carrier', faction: 'turkey', country: 'TR', lat: 34.0, lng: 34.5, description: 'Turkey\'s first aircraft carrier / LHD, 27,000 tonnes. Commissioned 2023. Can operate Bayraktar TB3 armed drones and helicopters. Deployed to Eastern Mediterranean. Turkey\'s flagship for regional power projection.' },

  // ═══════════════════════════════════════════════════════════════════════════
  // EGYPTIAN NAVY
  // ═══════════════════════════════════════════════════════════════════════════
  { id: 'eg-mistral1', name: 'ENS Gamal Abdel Nasser Mistral carrier', type: 'carrier', faction: 'egypt', country: 'EG', lat: 31.5, lng: 32.0, description: 'Mistral-class helicopter carrier (ex-French, originally built for Russia). 21,000 tonnes, carries Ka-52K attack helicopters. Egypt\'s largest warship. Patrols Eastern Mediterranean and Red Sea approaches to Suez Canal.' },

  // ═══════════════════════════════════════════════════════════════════════════
  // MARITIME INCIDENTS (Targeted / Attacked Vessels)
  // ═══════════════════════════════════════════════════════════════════════════
  { id: 'mkd-vyom', name: 'Tanker MKD VYOM', type: 'boat', faction: 'neutral', lat: 24.4, lng: 58.6, description: 'Oil tanker struck by projectile north of Muscat. One of many vessels targeted in the escalating maritime conflict in the Gulf of Oman and Arabian Sea.' },
  { id: 'safeen-prestige', name: 'Safeen Prestige Container', type: 'boat', faction: 'neutral', lat: 26.3, lng: 56.5, description: 'Container ship damaged by anti-ship missile attack in the Strait of Hormuz. Highlights vulnerability of commercial shipping in the world\'s most critical oil transit route.' },
  { id: 'galaxy-leader', name: 'Galaxy Leader ship hijacked', type: 'boat', faction: 'yemen', lat: 15.3, lng: 42.6, description: 'Vehicle carrier hijacked by Houthi forces on Nov 19, 2023 — the event that triggered the Red Sea shipping crisis. Israeli-linked ownership. Crew still held hostage off Hodeidah. Became symbol of Houthi maritime campaign.' },
  { id: 'rubymar', name: 'M/V Rubymar (Sunk)', type: 'boat', faction: 'neutral', lat: 13.3, lng: 43.2, description: 'British-registered bulk carrier hit by Houthi anti-ship ballistic missiles on Feb 18, 2024. Sank on Mar 2, becoming the first vessel sunk in the Red Sea crisis. Cargo of fertilizer raised environmental concerns.' },
  { id: 'true-confidence', name: 'True Confidence', type: 'boat', faction: 'neutral', lat: 12.0, lng: 44.5, description: 'Barbados-flagged bulk carrier struck by Houthi anti-ship ballistic missile on Mar 6, 2024 in the Gulf of Aden. Three crew killed — the first fatalities from a Houthi attack on a commercial vessel.' },
  { id: 'stena-imperative', name: 'Stena Imperative', type: 'boat', faction: 'neutral', lat: 26.2, lng: 50.6, description: 'US-flagged products tanker struck by projectiles near Bahrain port. Demonstrates the geographic spread of attacks beyond the traditional Red Sea / Gulf of Aden zone.' }
];

// Historical major kinetic events spanning the last 180+ days for filtering
export const HISTORICAL_STRIKES: HistoricalStrike[] = [
  // Israel / US Strikes
  { id: 'hs-1', targetName: 'Hodeidah Port', attacker: 'israel', lat: 14.8238, lng: 42.9268, date: new Date(Date.now() - 15 * 86400000).toISOString(), description: 'IAF airstrikes on Houthi oil and power infrastructure.' }, 
  { id: 'hs-2', targetName: 'Beirut Southern Suburbs', attacker: 'israel', lat: 33.8471, lng: 35.5134, date: new Date(Date.now() - 10 * 86400000).toISOString(), description: 'Targeted airstrike on Hezbollah command structures.' }, 
  { id: 'hs-3', targetName: 'Isfahan Air Defense', attacker: 'israel', lat: 32.7483, lng: 51.7588, date: new Date(Date.now() - 8 * 86400000).toISOString(), description: 'Israeli retaliatory drone strike on radar system.' },
  { id: 'hs-4', targetName: 'South Pars Gas Field', attacker: 'israel', lat: 27.5, lng: 52.5, date: new Date(Date.now() - 3 * 86400000).toISOString(), description: 'Strike on Iranian energy infrastructure.' },

  // Iranian / Proxy Strikes
  { id: 'hs-5', targetName: 'Nevatim Airbase', attacker: 'iran', lat: 31.2069, lng: 35.0118, date: new Date(Date.now() - 2 * 86400000).toISOString(), description: 'Ballistic missile barrage targeting IAF bases.' },
  { id: 'hs-6', targetName: 'US Base Tower 22', attacker: 'iran', lat: 33.3218, lng: 38.6816, date: new Date(Date.now() - 25 * 86400000).toISOString(), description: 'Drone strike by Iran-backed militia in Jordan.' }, 
  { id: 'hs-7', targetName: 'Red Sea Com. Vessel', attacker: 'yemen', lat: 13.5, lng: 42.5, date: new Date(Date.now() - 1 * 86400000).toISOString(), description: 'Houthi anti-ship ballistic missile strike.' }, 
  { id: 'hs-8', targetName: 'Port of Salalah Fuel Tanks', attacker: 'iran', lat: 16.94, lng: 54.01, date: new Date(Date.now() - 11 * 86400000).toISOString(), description: 'Iranian drones struck fuel storage tanks.' },
  { id: 'hs-9', targetName: 'Stena Imperative', attacker: 'iran', lat: 26.2, lng: 50.6, date: new Date(Date.now() - 21 * 86400000).toISOString(), description: 'US-flagged products tanker struck by projectiles in Bahrain port.' },
  { id: 'hs-10', targetName: 'SAMREF Refinery', attacker: 'iran', lat: 24.03, lng: 38.05, date: new Date(Date.now() - 3 * 86400000).toISOString(), description: 'Iranian drone attack on Saudi Red Sea refinery in Yanbu.' },
  
  // Older historical
  { id: 'hs-11', targetName: 'Damascus Consulate', attacker: 'israel', lat: 33.5138, lng: 36.2765, date: new Date(Date.now() - 120 * 86400000).toISOString(), description: 'Targeted airstrike against IRGC commanders.' },
  { id: 'hs-12', targetName: 'USS Gravely Intercept', attacker: 'yemen', lat: 14.5, lng: 42.0, date: new Date(Date.now() - 150 * 86400000).toISOString(), description: 'Naval interception of Houthi cruise missiles.' }
];
