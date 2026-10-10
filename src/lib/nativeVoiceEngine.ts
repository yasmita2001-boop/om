/**
 * Native Voice Engine with Extended Personas, Voice Matching (Pitch & Tone Sliders),
 * Frequency Analysis, and Audio Sample Preview.
 */

export type VoicePersona = 
  | 'female_calm'       // Calm, pleasant, clear narrator (Veena/Kalpana/Zira)
  | 'female_warm'       // Warm, encouraging, soft storytelling
  | 'male_clear'        // Deep, authoritative, clear news anchor (Hemant/Rishi/David)
  | 'male_casual'       // Friendly, energetic, conversational buddy
  | 'storyteller'       // Expressive, rich pauses, captivating narrative
  | 'whisper_relax'     // Soft, soothing, mindful reading
  | 'corporate_exec'    // Professional, crisp, confident business tone
  | 'academic_teacher'  // Explanatory, measured, articulate pedagogical cadence
  | 'radio_rj'          // Lively, upbeat, vibrant radio presenter cadence
  | 'auto_best';        // Automatically selects highest neural quality voice

export interface SpeechVoiceOption {
  voice: SpeechSynthesisVoice;
  displayName: string;
  lang: string;
  gender: 'female' | 'male' | 'neutral';
  isIndian: boolean;
  isHindi: boolean;
  score: number;
}

export interface VoiceTuningParams {
  rate: number;         // 0.6 to 1.6 (Speed / गति)
  pitch: number;        // 0.6 to 1.5 (Voice Tone / सुर / पिच)
  pauseWeight: number;  // 0.5 to 1.8 (Pause Duration multiplier / ठहराव)
  volume?: number;      // 0.1 to 1.0 (आवाज़ का स्तर)
}

export interface VoiceMatchPreset {
  id: string;
  name: string;
  nameHi: string;
  desc: string;
  icon: string;
  pitch: number;
  rate: number;
  pauseWeight: number;
  recommendedGender: 'female' | 'male' | 'any';
}

/**
 * Persona presets: Sets baseline pitch, rate, pauses and persona descriptions
 */
export const PERSONA_PRESETS: Record<VoicePersona, { 
  label: string; 
  labelHi: string;
  desc: string; 
  descHi: string;
  icon: string; 
  gender: 'female' | 'male' | 'any'; 
  tuning: VoiceTuningParams;
  tags: string[];
}> = {
  female_calm: {
    label: 'Female Calm (Narrator)',
    labelHi: 'शालीन वाचक (Narrator)',
    desc: 'Clear, gentle, and peaceful cadence for articles & notes',
    descHi: 'शांत, स्पष्ट और सौम्य वाचन - अध्ययन एवं लेखों के लिए',
    icon: '🌸',
    gender: 'female',
    tuning: { rate: 0.95, pitch: 1.06, pauseWeight: 1.0, volume: 1.0 },
    tags: ['Gentle', 'Articles', 'Notes', 'Clear']
  },
  female_warm: {
    label: 'Female Warm (Storyteller)',
    labelHi: 'मधुर कथा वाचक (Story)',
    desc: 'Warm, empathetic, sweet cadence for reflections & journals',
    descHi: 'मधुर, आत्मीय और भावपूर्ण आवाज़ - डायरी व कहानियों के लिए',
    icon: '☕',
    gender: 'female',
    tuning: { rate: 0.92, pitch: 1.14, pauseWeight: 1.15, volume: 1.0 },
    tags: ['Emotional', 'Journal', 'Sweet', 'Empathetic']
  },
  male_clear: {
    label: 'Male Clear (News Anchor)',
    labelHi: 'गंभीर वाचक (News Anchor)',
    desc: 'Deep, crisp, authoritative briefing & podcast cadence',
    descHi: 'गंभीर, वजनदार और स्पष्ट वाचन - पॉडकास्ट व समाचार शैली',
    icon: '🎙️',
    gender: 'male',
    tuning: { rate: 0.96, pitch: 0.88, pauseWeight: 1.0, volume: 1.0 },
    tags: ['Deep', 'Authoritative', 'Crisp', 'News']
  },
  male_casual: {
    label: 'Male Friendly (Buddy)',
    labelHi: 'उत्साही मित्र (Conversational)',
    desc: 'Upbeat, conversational, everyday Hinglish vibe',
    descHi: 'दोस्ताना, ऊर्जावान और स्वाभाविक बातचीत की शैली',
    icon: '⚡',
    gender: 'male',
    tuning: { rate: 1.04, pitch: 0.98, pauseWeight: 0.85, volume: 1.0 },
    tags: ['Upbeat', 'Hinglish', 'Casual', 'Fast']
  },
  storyteller: {
    label: 'Expressive Storyteller',
    labelHi: 'नाटकीय कथाकार (Dramatic)',
    desc: 'Dramatic pauses and rich emotional storytelling cadence',
    descHi: 'विश्राम और उतार-चढ़ाव के साथ प्रभावशाली कथा वाचन',
    icon: '📖',
    gender: 'any',
    tuning: { rate: 0.88, pitch: 1.04, pauseWeight: 1.35, volume: 1.0 },
    tags: ['Dramatic', 'Rich Pauses', 'Story', 'Captivating']
  },
  whisper_relax: {
    label: 'Mindful Meditative (Relax)',
    labelHi: 'शांत ध्यानमग्न (Zen Soft)',
    desc: 'Slow, serene, soothing whisper tone for meditation & focus',
    descHi: 'धीमी, कोमल और शांतिदायक आवाज़ - ध्यान और विश्राम के लिए',
    icon: '🍃',
    gender: 'female',
    tuning: { rate: 0.80, pitch: 0.94, pauseWeight: 1.45, volume: 0.9 },
    tags: ['Zen', 'Relaxation', 'Bedtime', 'Focus']
  },
  corporate_exec: {
    label: 'Executive Formal (Business)',
    labelHi: 'व्यावसायिक (Corporate Executive)',
    desc: 'Sharp, confident, articulate business presentation tone',
    descHi: 'आत्मविश्वासी, औपचारिक व पेशेवर कॉर्पोरेट प्रस्तुति शैली',
    icon: '💼',
    gender: 'male',
    tuning: { rate: 0.98, pitch: 0.95, pauseWeight: 0.95, volume: 1.0 },
    tags: ['Formal', 'Business', 'Confident', 'Polished']
  },
  academic_teacher: {
    label: 'Academic Professor (Teacher)',
    labelHi: 'शिक्षक एवं प्रोफ़ेसर (Educational)',
    desc: 'Measured, articulate, explanatory cadence with emphasis',
    descHi: 'गंभीर, समझाने वाली और स्पष्ट शैक्षणिक वाचन शैली',
    icon: '🎓',
    gender: 'any',
    tuning: { rate: 0.92, pitch: 1.00, pauseWeight: 1.10, volume: 1.0 },
    tags: ['Educational', 'Explanatory', 'Articulate', 'Study']
  },
  radio_rj: {
    label: 'Radio RJ (Dynamic Broadcaster)',
    labelHi: 'रेडियो जॉकी (Radio RJ Host)',
    desc: 'High energy, rhythmic, charming radio broadcaster cadence',
    descHi: 'तेज़, आकर्षक, मधुर और मनोरंजक रेडियो जॉकी का अंदाज़',
    icon: '📻',
    gender: 'any',
    tuning: { rate: 1.06, pitch: 1.10, pauseWeight: 0.90, volume: 1.0 },
    tags: ['Radio RJ', 'Dynamic', 'Lively', 'Charming']
  },
  auto_best: {
    label: 'Best AI Neural Voice',
    labelHi: 'सर्वश्रेष्ठ न्यूरल आवाज़ (AI Best)',
    desc: 'Auto-picks the highest fidelity neural system voice installed',
    descHi: 'सिस्टम में उपलब्ध सबसे प्राकृतिक और वास्तविक आवाज़ का चयन',
    icon: '🌟',
    gender: 'any',
    tuning: { rate: 0.96, pitch: 1.00, pauseWeight: 1.00, volume: 1.0 },
    tags: ['Neural', 'HD Voice', 'Auto', 'Natural']
  }
};

/**
 * Built-in Voice Matching Presets (सुर मिलाने के बने-बनाए विकल्प)
 */
export const VOICE_MATCH_PRESETS: VoiceMatchPreset[] = [
  {
    id: 'deep_baritone',
    name: 'Deep Baritone',
    nameHi: 'भारी व रोबदार आवाज़',
    desc: 'Low-frequency bass tone with solid authority',
    icon: '🎙️',
    pitch: 0.82,
    rate: 0.92,
    pauseWeight: 1.15,
    recommendedGender: 'male'
  },
  {
    id: 'sweet_melody',
    name: 'Sweet & Melodic',
    nameHi: 'मधुर व कोमल आवाज़',
    desc: 'High-frequency pleasant treble tone with soft cadence',
    icon: '🌸',
    pitch: 1.18,
    rate: 0.94,
    pauseWeight: 1.10,
    recommendedGender: 'female'
  },
  {
    id: 'natural_human',
    name: 'Natural Conversation',
    nameHi: 'स्वाभाविक बातचीत',
    desc: 'Balanced everyday speaking pitch and rhythm',
    icon: '💬',
    pitch: 1.00,
    rate: 0.96,
    pauseWeight: 1.00,
    recommendedGender: 'any'
  },
  {
    id: 'fast_energetic',
    name: 'Energetic & Fast',
    nameHi: 'उत्साही व तेज़',
    desc: 'Quick tempo for productive speed listening',
    icon: '⚡',
    pitch: 1.05,
    rate: 1.18,
    pauseWeight: 0.85,
    recommendedGender: 'any'
  },
  {
    id: 'radio_broadcaster',
    name: 'Radio Presenter',
    nameHi: 'रेडियो जॉकी शैली',
    desc: 'Punchy modulation and dynamic broadcaster cadence',
    icon: '📻',
    pitch: 1.10,
    rate: 1.08,
    pauseWeight: 0.95,
    recommendedGender: 'any'
  },
  {
    id: 'zen_meditation',
    name: 'Zen & Meditative',
    nameHi: 'शांत व ध्यानमग्न',
    desc: 'Slow, deep breathing pauses for mindful reading',
    icon: '🍃',
    pitch: 0.92,
    rate: 0.80,
    pauseWeight: 1.45,
    recommendedGender: 'any'
  }
];

/**
 * Analyzes audio buffer to estimate dominant pitch frequency (Hz) using autocorrelation
 */
export function estimatePitchFromAudioData(buffer: Float32Array, sampleRate: number): number {
  if (!buffer || buffer.length === 0) return 0;
  
  let maxCorrelation = 0;
  let bestOffset = -1;
  const minOffset = Math.floor(sampleRate / 500); // 500 Hz max
  const maxOffset = Math.floor(sampleRate / 70);  // 70 Hz min

  for (let offset = minOffset; offset <= maxOffset; offset++) {
    let correlation = 0;
    for (let i = 0; i < buffer.length - offset; i += 2) {
      correlation += buffer[i] * buffer[i + offset];
    }
    if (correlation > maxCorrelation) {
      maxCorrelation = correlation;
      bestOffset = offset;
    }
  }

  if (bestOffset > 0 && maxCorrelation > 0.05) {
    return Math.round(sampleRate / bestOffset);
  }
  return 0;
}

/**
 * Maps detected voice frequency (Hz) to optimal pitch and persona settings
 */
export function mapFrequencyToVoiceMatch(frequencyHz: number): {
  pitch: number;
  rate: number;
  pauseWeight: number;
  recommendedPersona: VoicePersona;
  detectedToneName: string;
} {
  if (frequencyHz > 0 && frequencyHz < 140) {
    return {
      pitch: 0.84,
      rate: 0.94,
      pauseWeight: 1.12,
      recommendedPersona: 'male_clear',
      detectedToneName: `भारी मर्दाना सुर (Deep Baritone ~${frequencyHz}Hz)`
    };
  } else if (frequencyHz >= 140 && frequencyHz < 190) {
    return {
      pitch: 0.98,
      rate: 0.96,
      pauseWeight: 1.0,
      recommendedPersona: 'male_casual',
      detectedToneName: `मध्यम स्वाभाविक सुर (Natural Balanced ~${frequencyHz}Hz)`
    };
  } else if (frequencyHz >= 190 && frequencyHz < 260) {
    return {
      pitch: 1.14,
      rate: 0.95,
      pauseWeight: 1.05,
      recommendedPersona: 'female_calm',
      detectedToneName: `मधुर कोमल सुर (Sweet Melodic ~${frequencyHz}Hz)`
    };
  } else if (frequencyHz >= 260) {
    return {
      pitch: 1.22,
      rate: 0.94,
      pauseWeight: 1.0,
      recommendedPersona: 'female_warm',
      detectedToneName: `उच्च मधुर सुर (High Treble ~${frequencyHz}Hz)`
    };
  }

  return {
    pitch: 1.0,
    rate: 0.95,
    pauseWeight: 1.0,
    recommendedPersona: 'auto_best',
    detectedToneName: 'संतुलित स्वाभाविक सुर (Standard Balanced)'
  };
}

/**
 * Preprocess Hindi, Hinglish and English text to sound like a native human narrator.
 */
export function prepareNativePhonetics(rawText: string, lang: 'hi-IN' | 'en-IN' | 'en-US' | 'auto'): { cleanText: string; isHindi: boolean } {
  if (!rawText) return { cleanText: '', isHindi: false };

  let text = rawText
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*[\/]?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, ' and ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim();

  const devanagariCount = (text.match(/[\u0900-\u097F]/g) || []).length;
  const isHindi = lang === 'hi-IN' || (lang === 'auto' && devanagariCount > 3);

  if (!isHindi) {
    text = text
      .replace(/\bw\/\b/gi, 'with ')
      .replace(/\bw\/o\b/gi, 'without ')
      .replace(/\bi\.e\./gi, 'that is, ')
      .replace(/\be\.g\./gi, 'for example, ')
      .replace(/\betc\./gi, 'and so on. ')
      .replace(/\bvs\.?\b/gi, 'versus ')
      .replace(/\bapprox\.?\b/gi, 'approximately ')
      .replace(/\basap\b/gi, 'as soon as possible ')
      .replace(/\byaar\b/gi, 'yaar, ')
      .replace(/\bbhai\b/gi, 'bhai, ')
      .replace(/\ba6a\b/gi, 'achha ')
      .replace(/\bacha\b/gi, 'achha ')
      .replace(/\bpls\b|\bplz\b/gi, 'please ')
      .replace(/\bthx\b|\btnx\b/gi, 'thanks ')
      .replace(/\bgovt\.?\b/gi, 'government ')
      .replace(/\bdept\.?\b/gi, 'department ')
      .replace(/\bmin\.?\b/gi, 'minutes ')
      .replace(/\bsec\.?\b/gi, 'seconds ')
      .replace(/\bhr\.?\b|\bhrs\.?\b/gi, 'hours ')
      .replace(/\bno\.\s*(\d+)/gi, 'number $1')
      .replace(/₹\s*(\d+)/g, '$1 rupees')
      .replace(/\$\s*(\d+)/g, '$1 dollars')
      .replace(/%/g, ' percent ');
  } else {
    text = text
      .replace(/₹\s*(\d+)/g, '$1 रुपये')
      .replace(/%/g, ' प्रतिशत ')
      .replace(/no\.\s*(\d+)/gi, 'नंबर $1');
  }

  text = text
    .replace(/^[\s*•\-–—►▪★■✓🎯💡⚡📌]+\s*/gm, '')
    .replace(/[*_~`#]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return { cleanText: text, isHindi };
}

export interface SpeechUnit {
  text: string;
  trailingPauseMs: number;
  pitchOffset: number;
}

export function splitIntoSpeechUnits(text: string, pauseMultiplier: number = 1.0): SpeechUnit[] {
  if (!text) return [];

  const rawClauses = text.split(/(?<=[.?!।\n;:])\s+/);
  const units: SpeechUnit[] = [];

  for (const raw of rawClauses) {
    const trimmed = raw.trim();
    if (!trimmed) continue;

    const lastChar = trimmed.slice(-1);
    let trailingPauseMs = 450;
    let pitchOffset = 0;

    if (lastChar === '?') {
      trailingPauseMs = 550;
      pitchOffset = 0.08;
    } else if (lastChar === '!') {
      trailingPauseMs = 500;
      pitchOffset = 0.05;
    } else if (lastChar === ';' || lastChar === ':') {
      trailingPauseMs = 350;
      pitchOffset = -0.02;
    } else if (lastChar === ',' || lastChar === '-') {
      trailingPauseMs = 280;
      pitchOffset = 0.02;
    } else if (lastChar === '.' || lastChar === '।') {
      trailingPauseMs = 450;
      pitchOffset = -0.03;
    }

    const calculatedPause = Math.round(trailingPauseMs * Math.max(0.4, Math.min(2.2, pauseMultiplier)));

    if (trimmed.length > 80 && trimmed.includes(',')) {
      const subParts = trimmed.split(/(?<=,)\s+/);
      subParts.forEach((part, idx) => {
        const pTrimmed = part.trim();
        if (pTrimmed) {
          units.push({
            text: pTrimmed,
            trailingPauseMs: idx === subParts.length - 1 ? calculatedPause : Math.round(280 * pauseMultiplier),
            pitchOffset: idx === subParts.length - 1 ? pitchOffset : 0.02
          });
        }
      });
    } else {
      units.push({
        text: trimmed,
        trailingPauseMs: calculatedPause,
        pitchOffset
      });
    }
  }

  return units;
}

/**
 * Filter and categorize all voices with human-friendly names
 */
export function getCategorizedVoices(voices: SpeechSynthesisVoice[]): SpeechVoiceOption[] {
  if (!voices || voices.length === 0) return [];

  return voices.map((v) => {
    const nameLower = v.name.toLowerCase();
    const langLower = v.lang.toLowerCase().replace('_', '-');
    const isHindi = langLower.includes('hi') || nameLower.includes('hindi') || nameLower.includes('kalpana') || nameLower.includes('hemant');
    const isIndian = isHindi || langLower.includes('en-in') || nameLower.includes('india') || nameLower.includes('veena') || nameLower.includes('neerja') || nameLower.includes('rishi');

    let gender: 'female' | 'male' | 'neutral' = 'neutral';
    if (
      nameLower.includes('female') ||
      nameLower.includes('veena') ||
      nameLower.includes('kalpana') ||
      nameLower.includes('neerja') ||
      nameLower.includes('swara') ||
      nameLower.includes('zira') ||
      nameLower.includes('samantha') ||
      nameLower.includes('victoria') ||
      nameLower.includes('karen')
    ) {
      gender = 'female';
    } else if (
      nameLower.includes('male') ||
      nameLower.includes('hemant') ||
      nameLower.includes('rishi') ||
      nameLower.includes('david') ||
      nameLower.includes('ravi') ||
      nameLower.includes('madhur') ||
      nameLower.includes('george') ||
      nameLower.includes('daniel')
    ) {
      gender = 'male';
    }

    let score = 50;
    if (isHindi) score += 60;
    if (isIndian) score += 40;
    if (nameLower.includes('natural') || nameLower.includes('neural')) score += 30;
    if (nameLower.includes('google')) score += 20;

    let cleanName = v.name
      .replace(/Microsoft\s+/gi, '')
      .replace(/Google\s+/gi, 'Google ')
      .replace(/Online\s*\(Natural\)\s*-\s*/gi, '')
      .replace(/\(United States\)/gi, '(US)')
      .replace(/\(United Kingdom\)/gi, '(UK)')
      .replace(/\(India\)/gi, '(India)')
      .trim();

    return {
      voice: v,
      displayName: cleanName,
      lang: v.lang,
      gender,
      isIndian,
      isHindi,
      score
    };
  }).sort((a, b) => b.score - a.score);
}

/**
 * Pick optimal voice matching persona, language, and gender preferences
 */
export function pickOptimalVoice(
  voices: SpeechSynthesisVoice[],
  targetLang: 'hi-IN' | 'en-IN' | 'en-US' | 'auto',
  preferGender: 'female' | 'male' | 'any' = 'any',
  exactVoiceName?: string
): SpeechSynthesisVoice | null {
  if (!voices || voices.length === 0) return null;

  if (exactVoiceName) {
    const found = voices.find(v => v.name === exactVoiceName);
    if (found) return found;
  }

  const isHindi = targetLang === 'hi-IN';

  const scoreVoice = (v: SpeechSynthesisVoice): number => {
    let score = 0;
    const vLang = v.lang.toLowerCase().replace('_', '-');
    const vName = v.name.toLowerCase();

    if (isHindi) {
      if (vLang === 'hi-in' || vLang.startsWith('hi')) score += 120;
      else if (vName.includes('hindi') || vName.includes('kalpana') || vName.includes('hemant')) score += 100;
      else return -100;
    } else {
      if (vLang === 'en-in') score += 100;
      else if (vName.includes('india') || vName.includes('rishi') || vName.includes('veena') || vName.includes('neerja')) score += 95;
      else if (vLang === 'en-gb') score += 70;
      else if (vLang === 'en-us') score += 65;
      else if (vLang.startsWith('en')) score += 50;
      else return -100;
    }

    if (vName.includes('natural') || vName.includes('neural')) score += 30;
    if (vName.includes('google')) score += 20;

    if (preferGender === 'female') {
      if (vName.includes('female') || vName.includes('veena') || vName.includes('kalpana') || vName.includes('neerja') || vName.includes('swara') || vName.includes('zira')) {
        score += 25;
      }
    } else if (preferGender === 'male') {
      if (vName.includes('male') || vName.includes('hemant') || vName.includes('rishi') || vName.includes('david') || vName.includes('ravi') || vName.includes('madhur')) {
        score += 25;
      }
    }

    return score;
  };

  const sorted = [...voices]
    .map(v => ({ voice: v, score: scoreVoice(v) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score);

  return sorted.length > 0 ? sorted[0].voice : voices[0];
}

