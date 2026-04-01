## Purpose of the dashboard system

The dashboard system exists to show how **low-level workflow improvements** change **org-wide leverage**.

It does that by linking:

**Dev Time → Completions → Business Outcomes**

Across the system:

* **raw capacity** is dev time
* **elements of leverage** are areas of improvement
* each element has its own **completion**
* each element has its own **current leverage**
* improvement changes the leverage of one or more elements
* the top-level page aggregates those changes into org-wide impact

This is consistent with the PDF’s treatment of SDLC work as “units of leverage,” with structural and decision effects changing the overall shape rather than just speeding up activity. 

# 1. How leverage links low-level improvements to org outcomes

## At the low level

Each area of improvement is a workflow that converts dev time into completion-attempts.

For that area, the dashboard asks:

* how much dev time is being consumed?
* how many completion-attempts are occurring?
* what is the **completion yield**?
* what is the resulting **current leverage**?

So low-level improvement means improving one or more of:

* **efficiency improvement**
  less dev time per completion-attempt or per valid completion

* **yield improvement**
  a higher rate or share of completion-attempts that are valid

* **structural improvement**
  changing the system so the workflow becomes easier, more reliable, more reusable, or less necessary

* **elimination**
  removing unnecessary jobs or completions altogether

## At the intermediate level

When an element’s leverage improves, one of four things happens:

* the same dev time produces more valid completions
* the same valid completions require less dev time
* the same work produces fewer failed/flawed/false/missed completions
* unnecessary work shrinks

This is the bridge from workflow metrics to organizational capacity.

## At the org-wide level

The org-wide page rolls up all elements of leverage and answers:

* how much total dev time is represented by the system’s **aperture**?
* how much of that dev time is in **improvable aperture**?
* how is dev time currently distributed across elements?
* what is the current leverage of those elements?
* what would improved leverage look like if the identified changes are made?
* how do those changes translate into higher-level business outcomes?

So the leverage concept links levels like this:

**workflow improvement → element leverage improvement → reclaimed or better-used capacity → more/better completions → business outcomes**

# 2. Job of the top-level page

The top-level page is the **org-wide leverage map**.

Its job is not to explain every workflow in detail.
Its job is to show the whole shape.

## The top-level page should answer 6 questions

### 1. How much raw capacity is in scope?

How much dev time is represented by the dashboard system?

This is the **aperture** question.

### 2. Where is that dev time going?

How is raw capacity distributed across the elements of leverage?

This is the portfolio allocation question.

### 3. What kinds of jobs dominate?

How much of the aperture is going to:

* value-creating jobs
* risk-reducing jobs
* non-value-creating jobs

### 4. What is the current org-wide leverage shape?

How much valid completion is being produced from the represented dev time?

### 5. Where is the room for improvement?

Which elements have the largest gaps due to:

* low efficiency
* low completion yield
* weak structure
* unnecessary jobs or completions

### 6. What is the path to higher-level outcomes?

How would improvements in the main elements translate into:

* more valid completions
* more available capacity
* reduced risk
* reduced waste
* better business outcomes

## The top-level page is therefore a page for:

* **orientation**
* **aperture**
* **allocation**
* **prioritization**
* **translation to org outcomes**

# 3. Job of the element / area-of-improvement pages

Each element page exists to explain one **element of leverage**.

Its job is to show how one workflow currently behaves, why its leverage is what it is, and how it can improve.

## Each element page should answer 7 questions

### 1. What is the job to be done?

What workflow is this page about?

### 2. What counts as a completion?

What is the completion for this workflow?

### 3. What class of job is it?

Is it:

* value-creating
* risk-reducing
* non-value-creating

### 4. How much dev time does this element consume?

How large is this element inside total aperture?

### 5. What is the current leverage?

What is the current relationship between:

* dev time
* completion-attempts
* completion yield
* valid completions

### 6. Why is leverage limited?

What is constraining this workflow?
Usually some combination of:

* poor efficiency
* poor yield
* structural weakness
* unnecessary work

### 7. What improvement pattern applies?

How can leverage improve here through:

* efficiency improvement
* yield improvement
* structural improvement
* elimination

## The element page is therefore a page for:

* **definition**
* **diagnosis**
* **causal explanation**
* **improvement design**
* **translation back to top-level impact**

# 4. Relationship between the pages

The top page and the element pages should work as a hierarchy.

## Top-level page

Shows:

* the whole leverage shape
* aperture
* major elements
* biggest opportunities
* business translation

## Element page

Explains:

* one element’s workflow
* its completion
* its completion yield
* its current leverage
* its losses
* its room for improvement

So the user should be able to move through the system like this:

### From the top-level page

“I see this element is a large consumer of dev time and has major room for improvement.”

### Into the element page

“I now see exactly why the element has weak leverage and which mechanism would improve it.”

### Back to the top-level page

“I can now understand how changing this element improves the org-wide leverage shape.”

# 5. Clean conceptual formula for the system

At the element level:

**Dev Time → Completion-Attempts → Valid Completions**

Where:

* **completion yield** = valid completion-attempts / total completion-attempts
* **current leverage** = valid completions / dev hour

Improvement changes one or more parts of that chain.

At the org level:

**Total Raw Capacity → Portfolio of Elements of Leverage → Combined Valid Completions → Business Outcomes**

That is the backbone of the whole dashboard system.

# 6. Simplest way to describe the jobs of the two page types

## Top-level page

**Show how org-wide dev time is distributed across elements of leverage, where the biggest room for improvement is, and how improving those elements changes org outcomes.**

## Element page

**Show how one workflow converts dev time into completion-attempts and valid completions, why leverage is currently limited, and which improvement mechanisms can raise leverage.**

That is probably the cleanest system definition so far.

If you want, the next good step is to turn this into a short **dashboard design spec** with:

* top-level page responsibilities
* element page responsibilities
* common cards and visuals for each.
