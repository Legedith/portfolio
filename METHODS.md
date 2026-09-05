# Study 001 — The geometry of possibility

An interactive kinematics study for Jatin Dehmiwal's portfolio. This implements established methods; it is not presented as a new research result, a hardware controller, or a physical experiment.

## Model and task

Seven spatial revolute joints act on a three-dimensional **position** target. Tool orientation is deliberately unconstrained. Joint axes and link offsets are defined in `assets/kinematics.js`; translations use metres and joint angles use radians. The geometry is illustrative, not an identified commercial robot.

Forward kinematics composes each local joint rotation and link displacement. The position Jacobian column for revolute joint i is `a_i × (x_tip − p_i)`, with the joint axis and origin expressed in world coordinates. This is a 3 × 7 Jacobian. At rank three, its null space has dimension four. The readout computes `7 − rank(J)`; it does not assume rank is always three.

## Reach

The update is `Δq = Jᵀ (J Jᵀ + λ² I)⁻¹ Δx`.

The small linear system is solved with pivoted elimination. The default damping is 0.012; the method dialog exposes a 0.001–0.080 range. Task increments and joint increments are bounded. Joint positions are clipped to model limits, and a short backtracking line search rejects steps that increase position error. A finite iteration budget prevents an unreachable target from occupying the browser indefinitely. The solver does not promise global convergence. A remaining residual is shown rather than concealed or relabelled as a successful solve.

## Hold the point

A posture preference supplies a secondary joint direction. The row space of the current Jacobian is orthonormalized with reorthogonalized Gram–Schmidt. Removing those row-space components gives `N v = (I − J⁺ J) v`, to floating-point precision away from the numerical rank threshold.

**The null projector does not use the damped inverse.** Substituting the damped inverse in `I − J# J` generally leaves task-space leakage. Here, exact row-space projection supplies the infinitesimal null direction, and a separate damped solve corrects finite-step drift. A candidate is accepted only when its measured residual is below 0.00002 m; otherwise the null step is reduced or rejected. Projection alone would not exactly preserve a point under finite joint changes.

The moving preference is procedural, but the joint path is solved at runtime. Ghost lines represent recent solved configurations, not invented alternative solutions. Selecting this mode locks the currently achieved tool point, including after a failed reach request.

## Trace a knot

The target is a spatial trefoil, sampled at the current phase. Each frame solves for its new position using the preceding joint vector as a warm start. The faint curve is the requested path. The coloured trail is the actual forward-kinematic tool path; they need not be identical when the solver has residual error.

## Dexterity and measurements

The optional dexterity overlay is a local velocity manipulability ellipsoid. A Jacobi eigensolver diagonalizes `J Jᵀ`; principal axes are the eigenvectors and radii are their square-root eigenvalues. The displayed ellipsoid has a uniform visual scale factor of 0.16. It is **not** a reachable workspace. The conditioning readout is `σ_min / σ_max`, calculated from that eigensystem. Rank uses an absolute singular-value threshold of 1e-7 in the model's units.

Position error is `||target − FK(q)||`, converted to millimetres for display. Values below 0.001 mm are shown as `< 0.001 mm`, not rounded to an asserted exact zero. These are numerical simulation errors, not measured hardware accuracy.

## Limits

Position-only kinematics, with joint bounds. No collision checking, contact, gravity, torque limits, inertia, actuator rates, calibrated link parameters, or sensor noise. Some geometries can self-intersect or intersect the reference ground plane. The shaded meshes are for presentation, not collision geometry. Do not use this code to control a physical robot.

The renderer is a small orthographic 3D renderer built with Canvas 2D and depth-sorted shaded polygons. It uses the actual forward-kinematic geometry and needs no WebGL, downloaded model, external font, framework, tracking script, or remote runtime. It is not a prerecorded animation.

## Interaction and accessibility

Drag the target to move it in an X–Z plane; the depth slider changes Y. Arrow keys move X/Z by 10 mm (50 mm with Shift). Page Up/Down moves Y. The view buttons rotate the orthographic camera. Mouse dragging the background also rotates it; touch dragging outside the target retains page scrolling. Only the 48 px target handle captures touch.

The experiment begins stationary. Automatic motion is opt-in through the two animated modes and can be paused. System reduced motion disables autoplay, while sliders still explore discrete solved postures and curve points. Off-screen and background-tab drawing stops. Histories have explicit caps. A static schematic, project links, method source, and contact information remain available without JavaScript.

## Reproduce the tests

Run `npm test` (or `node --test tests/kinematics.test.mjs`) for deterministic numerical tests. These include 100 forward-kinematic poses, central finite-difference Jacobians, 80 reachable warm starts, null-space velocity checks, 1,200 null steps, 1,200 trefoil samples, eigensystem residuals, singular inputs, unreachable targets, and input validation.

The optional `python3 scripts/test_research_browser.py` suite needs Playwright and Chromium. It combines the same source modules into an inline module so it can run offline. It checks 12 viewport sizes and 38 interactions. This does not test browser network loading, a physical touchscreen, Safari, or every accessibility criterion. The original module imports and static resource paths are checked separately. Results are committed under `tests/`.

## References

- Samuel R. Buss, *Introduction to Inverse Kinematics with Jacobian Transpose, Pseudoinverse and Damped Least Squares Methods* (2004). Author's page: https://www.math.ucsd.edu/~sbuss/ResearchWeb/ikmethods/index.html
- Kevin M. Lynch and Frank C. Park, *Modern Robotics*, §6.2, Numerical Inverse Kinematics: https://modernrobotics.northwestern.edu/nu-gm-book-resource/6-2-numerical-inverse-kinematics-part-1-of-2/
- Lynch and Park, §5.3, Singularities and redundant motion: https://modernrobotics.northwestern.edu/nu-gm-book-resource/5-3-singularities/
- Lynch and Park, §5.4, Manipulability: https://modernrobotics.northwestern.edu/nu-gm-book-resource/5-4-manipulability/

The portfolio's biography and selected projects derive from the author's existing public profile and repositories. The earlier `SOURCES.md` remains as provenance for previous editions. No academic appointment, degree, publication, award, employer, or experimental hardware metric is invented by this redesign.
