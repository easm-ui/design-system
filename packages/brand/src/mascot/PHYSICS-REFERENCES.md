# The science behind the guide, and where it is simplified

Each section says what the code does, what it rests on, and what it leaves
out. The aim is a cartoon whose motion and attention feel physically and
biologically right, not a simulation of real fur or real eyes.

## Body: a soft ball (`BodyPhysics.ts`)

- **Ballistic hops.** After an anticipation crouch (90–150 ms, deeper for
  longer hops), she leaves the ground with the velocity that reaches the
  target under constant gravity, and lands on it. Gravity is 15.5 body radii
  per second², so a hop takes the same time whether she is drawn at 46 px in a
  corner or 140 px on a stage. That is a deliberate break from physical
  scaling (small objects really do look faster); it keeps her timing
  consistent.
- **Squash and stretch, volume preserved.** Shape is a 2×2 strain plus a
  shear (lean), each a damped spring (about 3.2 Hz, ζ ≈ 0.32 for the strain).
  Targets: a uniaxial stretch along the velocity in flight, squash along the
  contact normal on impact, the crouch before take-off, and a held body pose
  from the expression (anticipation, landing, exhausted). The depth axis takes
  1/det, so volume is constant: the classic animation principle (Thomas &
  Johnston, *The Illusion of Life*, 1981) expressed as incompressibility.
  Deformation is about the contact point while she touches the floor, so the
  bottom stays planted and the squash lowers her centre.
- **Follow-through.** The lean (shear) is kicked backwards at take-off and
  forwards at landing: the top lags the base, as soft bodies do.
- **Dangling: an elastic pendulum.** Picked up, the centre of mass hangs from
  the grabbed point on a spring (static sag 0.16 radii) with gravity and
  damping, so she swings and stretches. She turns so the grabbed tuft faces
  the hand, and deformation is about the grab point so it stays exactly under
  the pointer. Let go, she keeps a blend of her swing and the hand's velocity.
- **Throws, bounces, rolling.** Free flight has light air drag; walls and the
  floor reflect with restitution 0.5 and 0.45 and send impulses into the
  squash spring. On the floor she rolls without slipping (spin = −v/r), so her
  face turns with the ground, then rights herself along the shortest way.
- Simplified: no internal pressure model, no finite-element body, no
  rolling friction beyond an exponential decay.

## Coat (`FurDynamics.ts`, `FurRenderer.ts`, `FurShaders.ts`)

- **Guide hairs** are a position-based model (Müller et al., "Position Based
  Dynamics", 2007): fixed 120 Hz steps, pinned roots, length and bend
  constraints, groom memory, damping, spherical skin contact. Forcing is
  gravity, body acceleration, rotating-frame terms (Euler, centrifugal,
  Coriolis) and air drag, so fur trails on take-off and stands up while
  falling, as in the library's movement sheet. The crown tuft is its own set
  of long, softer guides, so it bounces and droops. Not XPBD, no hair-to-hair
  collision.
- **Shells and fins.** The dense body of fur is concentric shells (Lengyel,
  Praun, Finkelstein & Hoppe, "Real-Time Fur over Arbitrary Surfaces", 2001);
  the silhouette is strand ribbons ("fins"). Shells follow a smooth groom
  field: fur leaves the skin, then lies down the body, straight down at the
  poles where "down the surface" vanishes, combed toward the tuft on top and
  radiating from the centre on the short-pile face disk. The guides add only
  motion beyond their settled sag, blended from the three nearest. An earlier
  version took shape from the nearest guides, whose comb directions jump
  between neighbours; that tore the shells into flaps.
- **Even strand coverage.** Fin roots use the R2 sequence (Roberts, "The
  unreasonable effectiveness of quasirandom sequences", 2018): two
  independent irrationals from the plastic number. Using the golden ratio for
  both height and angle puts every point on one spiral, which showed as sheets
  of fur wherever the spiral crossed the outline.
- **Shading** is an approximate Kajiya–Kay strand model (Kajiya & Kay,
  "Rendering Fur with Three Dimensional Textures", 1989): diffuse along the
  tangent, a soft specular, root darkening, brighter tips and a rim light. No
  multiple scattering (Moon & Marschner, 2006) or medulla (Yan et al., 2017).

## Eyes (`Gaze.ts`, eye shader)

- **Saccades** follow the main sequence (Bahill, Clark & Stark, "The main
  sequence, a tool for studying human eye movements", 1975): duration ≈ 21 ms
  + 2.2 ms per degree, with a minimum-jerk profile, after a 70–130 ms
  latency, aimed slightly ahead of a moving target. The check script measures
  this.
- **Smooth pursuit** follows a slowly moving target at about 0.88 gain;
  catch-up saccades cover the slip. A jump is not motion: pursuit holds while
  a saccade is pending.
- **Microsaccades**: small (0.7–1.7°) jumps every 0.6–2 s while fixating keep
  the gaze alive.
- **Head–eye coordination**: the eyes lead and the head follows with a
  spring (Andrist et al., "A Head-Eye Coordination Model for Animating Gaze
  Shifts of Virtual Characters", 2012). As the head catches up, the eyes
  counter-rotate to stay on target, as the vestibulo-ocular reflex does.
- **Vergence**: each eye aims at the target from its own position, so a
  pointer close to the face makes her cross-eyed.
- **Optokinetic nystagmus**: when the page scrolls, the eyes drift with the
  content and snap back.
- **Blinks**: spontaneous blinks at about 14 a minute (more when sleepy,
  scared or sad, fewer when interested), exponentially spaced, sometimes
  double. A lid closes faster than it reopens (Evinger, Manning & Sibony,
  "Eyelid movements", 1991). Large gaze shifts are often accompanied by a
  blink.
- **The eye itself**: a fixed globe with the iris and pupil sliding across
  it, lids that follow vertical gaze, and catchlights that ride with the iris,
  as reflections on a cornea bulging over it do. The globe is held slightly in
  front of the skin in depth, so it never sinks into the curved face when the
  head tilts.

## Mouth and voice (`LipSync.ts`)

- The jaw opens with the first formant and the lips spread or round with the
  second (Peterson & Barney, "Control Methods Used in a Study of the Vowels",
  1952: F1 rises with jaw opening, F2 is high for /i/ and low for /u/, /o/).
  Formants are estimated as power-weighted centroids within each formant's
  band. Fricatives (energy above 3.5 kHz) show teeth; nasal hum (below 300 Hz)
  closes the lips.
- Levels adapt (tracked noise floor and peak), the jaw has a faster attack
  than release, and stressed onsets lift the brows. Frames are delayed by the
  audio context's output latency so the mouth matches the speakers.
- Not phoneme recognition; a cartoon mouth from acoustics.

## Personality (`Personality.ts`)

Eleven feelings (joy, affection, interest, surprise, annoyance, sadness,
boredom, sleepiness, dizziness, fear, shyness) rise with what the visitor does
and decay toward a baseline at their own rates. The three strongest choose the
blend of library poses. Timelines, measured by the check script: pokes
escalate startle → pout → eye roll → raspberry → hmph; a visitor who is
present but ignoring her makes her wait, then feel ignored (about 40–75 s),
then hide below the edge (about 87 s, twice a session at most); nobody there
makes her drowsy, then asleep; coming back makes her pop up delighted. Only the
visitor's actions count as attention; her own hops do not. In conversation
(greeting, listening, speaking) she holds eye contact and glances at the
pointer only while it moves: a pointer left where the visitor clicked would
otherwise pull her eyes, and a gaze-evoked blink, to an empty spot every
second or two, which reads as an eye roll.

Negative states follow the library's own note: they are design references,
not tactics. They are triggered by what the visitor does to her (poking,
shaking, ignoring), never to pressure anyone into a reply or a form.
