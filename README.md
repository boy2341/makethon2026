# Jeevan-Setu

## Abstract

**Jeevan-Setu** is a Semi-LLM powered healthcare referral platform designed to bridge the gap between rural patients and appropriate medical facilities.  

The system intelligently connects patients to the most suitable hospitals for:
- 🚑 Emergency cases  
- 🏥 Long-term treatments  

Our goal is to ensure faster decision-making, better referral accuracy, and improved access to quality healthcare in underserved regions.

This platform provides two primary modules:
1. **Emergency Routing System** – Identifies and prioritizes the nearest and most capable hospital.
2. **Smart Referral Engine** – Matches patients with hospitals best suited to their medical needs.

The following sections describe the system architecture, technology stack, workflow, and implementation details.

## Referral Case

The **Referral Module** focuses on providing rural patients with accurate hospital recommendations for non-immediate but critical medical needs.

Many rural patients face challenges in accessing appropriate healthcare due to:
- Lack of structured medical guidance
- Information gaps about hospital capabilities
- Distance constraints
- Limited availability of specialists

### How It Works

1. The system collects basic patient details:
   - Age
   - Gender
   - Symptoms
   - Previous reports (if available in PDF Format)

2. The input is processed through a Semi-LLM pipeline to:
   - Extract medical intent
   - Identify probable condition category
   - Determine required specialization

3. The system then matches the patient with hospitals based on:
   - Specialist availability
   - Bed capacity
   - Distance
   - Hospital capability score

4. A ranked list of hospitals is generated, ensuring:
   - Medical suitability
   - Reasonable travel distance
   - Resource availability

This ensures intelligent, data-driven referrals rather than random hospital selection.

## Emergency Case

The **Emergency Routing Module** is designed for time-critical medical situations.

In emergency scenarios, decision speed is more important than deep analysis. The system prioritizes:

- Nearest capable hospital
- Real-time bed availability
- Emergency facility readiness
- Travel time estimation

### Emergency Flow

1. Patient selects emergency mode.
2. Basic symptoms are entered.
3. System categorizes urgency level.
4. Nearest suitable hospital is instantly recommended.
5. Auto-notification can be sent to the hospital.

This module reduces response time and improves survival probability in critical cases. The emergency sytem avoids LLM usage and rather uses basic analysis to keep the process quick and suited for the low internet speeds of Rural Areas
