# StudyQuest UI & Pixel Art Design System

A comprehensive guide to the retro 8-bit pixel art styling used throughout StudyQuest.

---

## 🎨 Design Philosophy

StudyQuest uses **CSS-based pixel art** - no external sprite sheets or image assets. Everything is rendered using:

- **CSS Box-shadow** for crisp pixel-perfect borders
- **CSS Gradients** for depth and color
- **Emoji** for icons and characters
- **Google Fonts** (`Press Start 2P`) for typography
- **Framer Motion** for smooth animations

---

## 📐 Core CSS Patterns

### 1. Pixel Border System

The foundation of our pixel art look uses `box-shadow` to create chunky 4px borders:

```css
/* 4px thick pixel border (main cards, containers) */
.pixel-border {
  box-shadow: 
    0 4px 0 0 #000,
    0 -4px 0 0 #000,
    4px 0 0 0 #000,
    -4px 0 0 0 #000,
    4px 4px 0 0 #000,
    -4px 4px 0 0 #000,
    4px -4px 0 0 #000,
    -4px -4px 0 0 #000;
}

/* 2px thin border (buttons, small elements) */
.pixel-border-sm {
  box-shadow: 
    0 2px 0 0 #000,
    0 -2px 0 0 #000,
    2px 0 0 0 #000,
    -2px 0 0 0 #000,
    2px 2px 0 0 #000,
    -2px 2px 0 0 #000,
    2px -2px 0 0 #000,
    -2px -2px 0 0 #000;
}

/* Gold accent border (achievements, premium) */
.pixel-border-gold {
  box-shadow: 
    0 4px 0 0 #b8860b,
    0 -4px 0 0 #b8860b,
    4px 0 0 0 #b8860b,
    -4px 0 0 0 #b8860b,
    4px 4px 0 0 #000,
    -4px 4px 0 0 #000,
    4px -4px 0 0 #000,
    -4px -4px 0 0 #000;
}
```

**Visual Result:**
```
Normal Border          Gold Border
┌──────────────┐      ┌──────────────┐
│              │      │██████████████│
│   Content    │      │█  Content  █│
│              │      │██████████████│
└──────────────┘      └──────────────┘
   ████████               ████████
```

---

### 2. Typography System

```css
@import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');

.font-pixel {
  font-family: 'Press Start 2P', cursive;
}
```

**Size Hierarchy:**
| Size | Usage | Example |
|------|-------|---------|
| `8px` | Labels, hints | "XP TO GO!" |
| `10px` | Stats, secondary | "750 / 1000 XP" |
| `12px` | Buttons, navigation | "START QUEST" |
| `14px` | Card titles | "HERO STATUS" |
| `18px` | Section headers | "QUEST MAP" |
| `24px+` | Hero text, titles | "EPIC QUEST" |

---

### 3. Color Palette

**Dark Theme Base:**
```css
--pixel-bg-primary: #1f2937;    /* slate-800 - card backgrounds */
--pixel-bg-dark: #111827;       /* slate-900 - page background */
--pixel-accent: #3b82f6;        /* blue-500 - primary actions */
--pixel-highlight: #60a5fa;     /* blue-400 - hover states */
--pixel-gold: #f59e0b;          /* amber-500 - XP, achievements */
--pixel-success: #10b981;       /* emerald-500 - correct answers */
--pixel-danger: #f43f5e;        /* rose-500 - errors, enemies */
--pixel-magic: #a855f7;         /* purple-500 - story moments */
```

**Feature Color Coding:**
| Feature | Primary | Border | Usage |
|---------|---------|--------|-------|
| Story Quest | Blue gradient | Blue-500 | Main adventure |
| Battle | Rose gradient | Rose-500 | Combat screens |
| Victory | Gold gradient | Amber-500 | Rewards, achievements |
| Learning | Blue-900 | Blue-600 | Study content |
| Social | Pink-800 | Pink-500 | Friends, groups |
| Progress | Emerald | Emerald-600 | Stats, goals |

---

### 4. Striped Progress Pattern

```css
.pixel-progress-bar {
  background: repeating-linear-gradient(
    90deg,
    transparent,
    transparent 8px,
    rgba(0,0,0,0.1) 8px,
    rgba(0,0,0,0.1) 16px
  );
}
```

**Visual:**
```
Filled Progress Bar:
████████████████████░░░░░░░░░░
▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░
████████████████████░░░░░░░░░░
```

---

## 🧩 Reusable Components

### 1. PixelCard

```jsx
const PixelCard = ({ title, icon, children, variant = 'default' }) => {
  const variants = {
    default: 'bg-slate-800 border-slate-600',
    primary: 'bg-blue-900 border-blue-600',
    success: 'bg-emerald-900 border-emerald-600',
    gold: 'bg-amber-900 border-amber-600',
    danger: 'bg-rose-900 border-rose-600'
  };
  
  return (
    <div className={`${variants[variant]} border-4 border-b-slate-900 border-r-slate-900`}>
      {title && (
        <div className={`bg-${variant === 'default' ? 'slate-700' : variant + '-800'} 
                         border-b-4 border-slate-900 px-4 py-3`}>
          <h2 className="font-pixel text-xs text-white flex items-center gap-2">
            {icon && <span className="text-lg">{icon}</span>}
            {title}
          </h2>
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
};

// Usage:
<PixelCard title="HERO STATUS" icon="⚔️" variant="gold">
  <p>Content here</p>
</PixelCard>
```

**Visual Output:**
```
┌─────────────────────────┐
│ ⚔️ HERO STATUS         │  ← Header with icon
├─────────────────────────┤
│                         │
│   Content here          │  ← Body
│                         │
└─────────────────────────┘
```

---

### 2. PixelButton

```jsx
const PixelButton = ({ children, onClick, variant = 'primary', disabled }) => {
  const baseStyles = "px-6 py-3 text-xs border-b-4 border-r-4 font-bold uppercase tracking-wider";
  
  const variants = {
    primary: "bg-blue-500 hover:bg-blue-400 border-blue-700 text-white",
    success: "bg-emerald-500 hover:bg-emerald-400 border-emerald-700 text-white",
    danger: "bg-rose-500 hover:bg-rose-400 border-rose-700 text-white",
    gold: "bg-amber-500 hover:bg-amber-400 border-amber-700 text-amber-950",
    ghost: "bg-slate-700 hover:bg-slate-600 border-slate-800 text-slate-200"
  };

  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      whileHover={{ scale: disabled ? 1 : 1.02, y: -2 }}
      whileTap={{ scale: disabled ? 1 : 0.98, y: 0 }}
      className={`${baseStyles} ${variants[variant]} ${className}`}
      style={{ fontFamily: 'monospace' }}
    >
      {children}
    </motion.button>
  );
};

// Usage:
<PixelButton variant="gold" onClick={startQuest}>
  ⚔️ BEGIN ADVENTURE
</PixelButton>
```

**Button States:**
```
Normal:          Hover:           Active (Click):
┌──────────┐     ┌──────────┐     ┌──────────┐
│  BUTTON  │  →  │  BUTTON  │  →  │  BUTTON  │
│          │     │    ↑     │     │          │
└────┬─────┘     └──────────┘     └──────────┘
     █████                        (depressed)
```

---

### 3. XP Bar Component

```jsx
const XPBar = ({ current, max, level }) => {
  const percentage = (current / max) * 100;
  
  return (
    <div className="space-y-2">
      {/* Level markers */}
      <div className="flex justify-between items-center">
        <span className="font-pixel text-[10px] text-yellow-400">LVL {level}</span>
        <span className="font-pixel text-[10px] text-yellow-400">LVL {level + 1}</span>
      </div>
      
      {/* Progress container */}
      <div className="h-6 bg-gray-900 border-4 border-gray-600 relative overflow-hidden">
        {/* Fill with striped pattern */}
        <div 
          className="h-full bg-yellow-500 pixel-progress-bar transition-all duration-500"
          style={{ width: `${percentage}%` }}
        >
          {/* Shine effect */}
          <div className="absolute inset-0 bg-gradient-to-b from-yellow-300/50 to-transparent h-1/2" />
        </div>
        
        {/* Grid overlay for retro look */}
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 10%, rgba(0,0,0,0.3) 10%, rgba(0,0,0,0.3) calc(10% + 2px))'
          }}
        />
      </div>
      
      {/* Stats */}
      <div className="flex justify-between items-center">
        <span className="font-pixel text-[8px] text-gray-400">{current} / {max} XP</span>
        <span className="font-pixel text-[8px] text-gray-500">{max - current} XP TO GO!</span>
      </div>
    </div>
  );
};

// Usage:
<XPBar current={750} max={1000} level={5} />
```

**Visual Output:**
```
LVL 5                    LVL 6
┌────────────────────────────────┐
│████████████░░░░░░░░░░░░░░░░░░░│  ← 75% filled
│▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░│  ← stripe pattern
│████████████░░░░░░░░░░░░░░░░░░░│  ← shine overlay
└────────────────────────────────┘
750 / 1000 XP        250 XP TO GO!
```

---

## 🎬 Animation Patterns

### 1. Bounce Animation (Icons, Emojis)

```css
@keyframes bouncePixel {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}

.bounce-pixel {
  animation: bouncePixel 0.5s steps(4) infinite;
}
```

**Usage:**
```jsx
<div className="text-5xl bounce-pixel">👾</div>
```

---

### 2. Blink Animation (Decorative pixels)

```css
@keyframes blinkPixel {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

.blink-pixel {
  animation: blinkPixel 1s steps(2) infinite;
}
```

**Usage (ambient background decoration):**
```jsx
<div className="absolute top-20 left-10 w-4 h-4 bg-yellow-500 blink-pixel" />
<div className="absolute top-40 right-20 w-4 h-4 bg-green-500 blink-pixel" 
     style={{ animationDelay: '0.5s' }} />
```

---

### 3. Glow Animation (Achievements, Stars)

```css
@keyframes pixelGlow {
  0%, 100% { filter: brightness(1); }
  50% { filter: brightness(1.3); }
}

.pixel-glow {
  animation: pixelGlow 2s ease-in-out infinite;
}
```

---

### 4. Enemy Pulse (Battle screen)

```jsx
<motion.div 
  animate={{ scale: [1, 1.1, 1] }}
  transition={{ duration: 2, repeat: Infinity }}
  className="w-20 h-20 bg-gradient-to-br from-rose-600 to-rose-800"
>
  👹
</motion.div>
```

---

### 5. Staggered Entry (Answer choices)

```jsx
{choices.map((choice, i) => (
  <motion.button
    key={i}
    initial={{ opacity: 0, x: -20 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay: i * 0.1 }}  // 100ms stagger
    whileHover={{ scale: 1.02, x: 5 }}
  >
    {choice.text}
  </motion.button>
))}
```

---

## 🎮 Screen-Specific Patterns

### Battle Screen Layout

```
┌─────────────────────────────────────────────┐
│ ⚔️ BATTLE 2/3                      ⚠️ BOSS  │  ← Header
├─────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────┐ │
│ │  👹        ENEMY                        │ │
│ │           Shadow Beast                  │ │
│ │           [███████░░░] HP               │ │
│ │  "You shall not pass!"                  │ │
│ └─────────────────────────────────────────┘ │  ← Enemy Card
│ ┌─────────────────────────────────────────┐ │
│ │  What is the derivative of x²?          │ │
│ └─────────────────────────────────────────┘ │  ← Question Card
│ ┌─────────────────────────────────────────┐ │
│ │ [A]  2x                           →    │ │
│ │ [B]  x²                           →    │ │
│ │ [C]  2                            →    │ │
│ └─────────────────────────────────────────┘ │  ← Answer Buttons
└─────────────────────────────────────────────┘
```

**Implementation:**
```jsx
const BattleScene = ({ scene, question, onAnswer }) => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-950 via-slate-900 to-slate-950">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Swords className="w-6 h-6 text-rose-400" />
          <span className="text-rose-400 text-sm font-bold" style={pixelText}>
            BATTLE {battleNumber}/{totalBattles}
          </span>
        </div>
        {scene.isBoss && (
          <div className="px-3 py-1 bg-amber-500/20 border border-amber-500 rounded-full">
            <span className="text-amber-400 text-xs font-bold">⚠️ BOSS</span>
          </div>
        )}
      </div>

      {/* Enemy Card */}
      <Card variant="danger" glow className="mb-6">
        <motion.div 
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="w-20 h-20 bg-gradient-to-br from-rose-600 to-rose-800 rounded-2xl"
        >
          {scene.isBoss ? '👹' : '👺'}
        </motion.div>
        {/* ... */}
      </Card>

      {/* Question */}
      <Card variant="default" className="mb-6">
        <p className="text-white text-lg" style={pixelText}>{question.text}</p>
      </Card>

      {/* Answers */}
      <div className="space-y-3">
        {question.choices.map((choice, i) => (
          <motion.button
            key={i}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className="w-full p-5 border-2 rounded-xl bg-slate-800 border-slate-600 
                       hover:border-blue-500 hover:bg-slate-700"
          >
            <span className="w-10 h-10 flex items-center justify-center 
                             bg-slate-700 text-slate-300 rounded-lg">
              {String.fromCharCode(65 + i)}  {/* A, B, C, D */}
            </span>
            <span className="text-slate-200" style={pixelText}>{choice.text}</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
};
```

---

### Hero Power Card

```
┌─────────────────────────────────────┐
│  ⚡  HERO POWER        🔥 5         │
│      75 / 100            DAY STREAK │
│ ┌─────────────────────────────────┐ │
│ │████████████████████░░░░░░░░░░░░│ │  ← 75% Hero Power
│ └─────────────────────────────────┘ │
├─────────────────────────────────────┤
│  👻 SHADOW OF DOOM        25%       │
│ ┌─────────────────────────────────┐ │
│ │████████████░░░░░░░░░░░░░░░░░░░░│ │  ← 25% Shadow
│ └─────────────────────────────────┘ │
│  ⚠️ Keep studying to push back!     │
└─────────────────────────────────────┘
```

**Implementation:**
```jsx
const StatsCard = ({ hero, shadow }) => {
  return (
    <PixelCard className="p-4" variant="primary">
      {/* Hero Section */}
      <div className="flex items-center gap-4 mb-4">
        <div className="w-14 h-14 bg-gradient-to-br from-amber-400 to-amber-600 
                        border-4 border-amber-800 rounded-lg">
          <Zap className="w-8 h-8 text-amber-950" />
        </div>
        <div className="flex-1">
          <p className="text-amber-400 text-xs font-bold">HERO POWER</p>
          <p className="text-white text-2xl font-bold">{hero?.power || 10} / 100</p>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-1 text-orange-400">
            <Flame className="w-5 h-5" />
            <span className="text-lg font-bold">{hero?.streakDays || 0}</span>
          </div>
          <p className="text-slate-500 text-[10px]">DAY STREAK</p>
        </div>
      </div>

      {/* Hero Power Bar */}
      <div className="h-3 bg-slate-900 border-2 border-slate-700 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-amber-500 to-yellow-400"
          initial={{ width: 0 }}
          animate={{ width: `${((hero?.power || 10) / 100) * 100}%` }}
          transition={{ duration: 1 }}
        />
      </div>

      {/* Shadow of Doom (conditional) */}
      {shadow?.level > 0 && (
        <div className="mt-4 pt-4 border-t-2 border-slate-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-purple-400 text-xs">SHADOW OF DOOM</span>
            <span className="text-purple-400 text-sm font-bold">{shadow.level}%</span>
          </div>
          <div className="h-2 bg-slate-900 border-2 border-slate-700 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-purple-900 to-purple-600"
              initial={{ width: 0 }}
              animate={{ width: `${shadow.level}%` }}
              transition={{ duration: 1 }}
            />
          </div>
        </div>
      )}
    </PixelCard>
  );
};
```

---

## 🎯 Best Practices

### 1. Consistent Spacing
- Use multiples of 4px for all spacing
- Card padding: `p-4` (16px) or `p-6` (24px)
- Gap between elements: `gap-4` (16px) or `space-y-3`

### 2. Border Contrast
- Always use `border-4` for main elements
- Use `border-b-slate-900 border-r-slate-900` for 3D depth effect
- Inner borders: `border-2` with lighter shade

### 3. Typography Hierarchy
- Uppercase for all pixel text: `uppercase`
- Tracking: `tracking-wider` for buttons, `tracking-widest` for headers
- Line height: `leading-relaxed` for readability

### 4. Interactive Feedback
```jsx
// Hover lift
whileHover={{ scale: 1.02, y: -2 }}

// Click depression  
whileTap={{ scale: 0.98, y: 0 }}
active:border-b-0 active:border-r-0

// Disabled state
disabled:opacity-50 disabled:cursor-not-allowed
```

### 5. Gradient Usage
```jsx
// Backgrounds
bg-gradient-to-b from-indigo-950 via-slate-900 to-slate-950

// Cards
bg-gradient-to-br from-blue-600 to-blue-800

// Progress bars
bg-gradient-to-r from-amber-500 to-yellow-400
```

---

## 📱 Responsive Considerations

The pixel art design is inherently mobile-friendly due to:
- Fixed 4px border system (scales consistently)
- Emoji icons (vector, always crisp)
- CSS-based rendering (no image assets)

**Breakpoints:**
```jsx
// Mobile-first approach
<div className="p-4 md:p-6 lg:p-8">
  <h1 className="text-lg md:text-xl lg:text-2xl font-pixel">
```

---

## 🔧 Customization Guide

### Adding a New Theme Color

1. **Define variant in component:**
```jsx
const variants = {
  // ... existing
  magic: 'bg-purple-600 hover:bg-purple-500 border-purple-800 text-white'
};
```

2. **Use with gradient:**
```jsx
className="bg-gradient-to-r from-purple-500 to-purple-600"
```

3. **Add border styling:**
```jsx
border-4 border-b-slate-900 border-r-slate-900
```

---

## 📚 Quick Reference

| Element | Class Combination |
|---------|-------------------|
| Primary Button | `bg-blue-500 border-b-4 border-r-4 border-blue-700 font-pixel` |
| Card Container | `bg-slate-800 border-4 border-slate-600 border-b-slate-900 border-r-slate-900` |
| Progress Bar | `bg-gray-900 border-4 border-gray-600 overflow-hidden` |
| Success State | `bg-emerald-500 border-emerald-700 text-white` |
| Danger State | `bg-rose-500 border-rose-700 text-white` |
| Gold Accent | `bg-amber-500 border-amber-700 text-amber-950` |
| Pixel Text | `font-pixel text-[10px] uppercase tracking-wider` |
| Glow Effect | `animate-pulse` or custom `pixel-glow` |
| Bounce Icon | `animate-bounce` or custom `bounce-pixel` |

---

## 🎨 Example: Complete Dashboard Card

```jsx
const QuestCard = ({ title, icon, description, onClick, color = 'blue' }) => {
  const colorMap = {
    blue: { bg: 'bg-blue-800', border: 'border-blue-500', text: 'text-blue-300' },
    green: { bg: 'bg-emerald-800', border: 'border-emerald-500', text: 'text-emerald-300' },
    purple: { bg: 'bg-purple-800', border: 'border-purple-500', text: 'text-purple-300' }
  };
  
  const c = colorMap[color];
  
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      className={`${c.bg} border-4 ${c.border} p-6 w-full text-left
                  hover:brightness-110 transition-all group`}
    >
      <div className="text-5xl mb-3 group-hover:animate-bounce">{icon}</div>
      <h3 className="font-pixel text-[10px] text-white mb-2 uppercase">
        {title}
      </h3>
      <p className={`font-pixel text-[8px] ${c.text}`}>
        {description}
      </p>
    </motion.button>
  );
};

// Usage:
<QuestCard 
  title="EPIC QUEST"
  icon="⚔️"
  description="RPG ADVENTURE MODE"
  color="purple"
  onClick={startQuest}
/>
```

---

*This design system enables rapid development of cohesive, retro-styled interfaces while maintaining modern React patterns and accessibility.*
