loop:
1. supervisor prompts target with an implementation step.
2. we feed step to task matcher to see if there is any relevant feedback from
previous attempts at this step or similar steps, and incorporate that into the
prompt for the target model.
3. supervisor reviews/scores target output.
4. supervisor makes a decision about what to do based on score (and, in later
iterations, previous atttempts): give feedback, break step down, escalate to
a more capable model, or mark step as complete.
5a. if feedback is given, the loop repeats with the same step and the feedback
from the previous attempt is incorporated into the prompt for the target model,
so we go back to step 1.
5b. if the step needs to be broken down, the supervisor model does so, then
makes a recursive call to restart the loop with the new sub-steps, so we repeat
step 1, only this time within a recursive loop with its entry point here.
5c. if we need to escalate, we swap in a more capable model and repeat step 1,
so we go back to step 1 UNLESS we have escalated to the supervisor model.
if so, the supervisor model attempts the task itself (if in autonomous mode),
marking it complete, or pauses the loop to alert the human for review.
in either case, the step and its context, along with the models that attempted
it, are fed to the task matching processor so that future similar tasks can be
escalated immediately.
5d. if step is marked complete, we gather the accumulated feedback (if any) for
the model that completed it and feed it to the task matching processor to be
disseminated into "durable" storage. all feedback should be tagged with information
about the model(s) that have attempted it.
6. move to the next step (see below), if any, or terminate task run.
