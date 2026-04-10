Business Value Engineering introduces some new terms and uses some common terms in a more precise way.
Consistent use of the terminology is important for humans and agents to ensure high levels of clarity, and interpretability.



## 1. Org-wide terms

**Business outcomes**
The highest-level results the organization cares about.

**Raw capacity**
Total dev time available to be converted into outcomes.

**Leverage**
The relationship between raw capacity and business outcomes.

**Leverage shape**
The org-level geometry showing how dev time converts into outcomes.

**Existing shape**
The current org-wide capacity-to-outcome relationship.

**Improved shape**
A better near-term shape achievable through improvement.

**Target shape / achievable shape**
A future desired shape representing a stronger operating model.

**Higher leverage**
More meaningful outcome from the same dev time, less dev time for the same outcome, or both.

**Aperture**
How much of org-wide dev time is actually represented by the model/dashboard.

**Improvable aperture**
The portion of represented time that can realistically be improved.

**Business translation**
The mapping from completions into revenue, margin, risk reduction, avoided loss, share, or similar business effects.

**Room for improvement**
The gap between current leverage and plausible improved leverage.

**Leverage rectangle**
A geometric representation of an element's leverage: width = dev-hours, height = completions, area = dev-hour × completions volume. The slope of the diagonal = leverage (completions / dev-hour).

**Integrated leverage**
The combined leverage across multiple elements, calculated as total completions / total dev-hours.

**Projection mode**
A scenario showing how leverage changes when a structural factor improves to 100%. Conservative picks the factor yielding the least change; aggressive picks the most impactful factor within a cap.

---

## 2. Element of Leverage terms

This is the level of an **Area of Improvement**.

**Element of leverage**
A bounded region of SDLC work with its own dev time, completions, losses, and improvement potential.

**Area of improvement**
A practical dashboardable element of leverage, such as AI Assisted Coding, PR Review, False Positives, or Onboarding.

**Job to be done**
The purpose the workflow exists to accomplish.

**Workflow**
The repeatable pattern of work that converts time into completions.

**Driver**
The unit volume used to size the element, such as PRs, dev-days, developers, new hires, existing vulns, or secrets exposed.

**Driver quantity**
The number of units in scope.

**Completion**
The observable event that means the workflow did its job.

**Valid completion**
A completion that actually achieved the intended purpose.

**Failed / flawed completion**
A completion that occurred but did not properly achieve the intended purpose.

**False completion**
An apparent completion that should not count.

**Missed completion**
A completion that should have happened but did not.

**Completion yield**
The rate or share of completion-attempts that are valid.

**Dev time**
The horizontal quantity consumed by the element.

**Completions**
The vertical quantity produced by the element.

**Current leverage**
Valid completions per dev hour for that element.

**Hours per completion**
The inverse of local leverage.

**Contingency**
A condition that determines whether the driver is exposed to a problem or opportunity.

**Losses**
Time, quality, or outcome losses inside the element, including failed, flawed, false, or missed completions.

**Necessary work**
Work that should exist and should be done better.

**Unnecessary work**
Work that exists because of poor structure, friction, rework, or preventable need.

---

## 3. Patterns of improvement by category and mechanism

First by **category**:

**Value-creating jobs**
Jobs whose valid completions directly create desired progress or output.

**Risk-reducing jobs**
Jobs whose valid completions reduce risk, exposure, defects, compliance burden, or security harm.

**Non-value-creating jobs**
Jobs that consume effort without directly creating value, often because of friction, coordination gaps, or prior weakness.

Then by **mechanism**:

**Efficiency improvement**
Reduce dev time per completion.

**Yield improvement**
Increase the share of valid completions; reduce failed, flawed, false, or missed completions.

**Structural improvement**
Change the surrounding system so the work becomes easier, more reliable, more reusable, or less necessary. This aligns with the recurring structural factors in your PDF such as adoption, coverage, availability, consistency, and predictability. 

**Elimination**
Remove unnecessary jobs or completions altogether.

**Reuse / compounding improvement**
Create assets, standards, automation, or patterns that improve future work repeatedly. This matches the flywheel/reuse emphasis in the PDF. 

**Decision improvement**
Choose better options, routes, or interventions so capacity is applied where leverage is highest. The PDF’s developer/agent flywheels point in this direction. 

## Compact version

### Org-wide

* Business outcomes
* Raw capacity
* Leverage
* Leverage shape
* Existing shape
* Improved shape
* Target shape
* Aperture
* Improvable aperture
* Business translation
* Room for improvement

### Element of Leverage

* Area of improvement
* Job to be done
* Workflow
* Driver
* Driver quantity
* Completion
* Valid completion
* Failed/flawed completion
* False completion
* Missed completion
* Completion yield
* Dev time
* Completions
* Current leverage
* Hours per completion
* Contingency
* Necessary work
* Unnecessary work

### Patterns of improvement

* Value-creating jobs
* Risk-reducing jobs
* Non-value-creating jobs
* Efficiency improvement
* Yield improvement
* Structural improvement
* Elimination
* Reuse / compounding improvement
* Decision improvement

One refinement I’d suggest next is to decide whether **completion yield** should remain the umbrella term for all three job categories, or whether risk-reducing jobs need a distinct term like **protective yield**.
