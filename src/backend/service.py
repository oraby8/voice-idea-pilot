import os
import json
from typing import  Dict
import dspy
import requests
import ssl
import argparse
import uvicorn
from fastapi import FastAPI
from fastapi.responses import JSONResponse, Response
from fastapi import File, UploadFile, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

lm = dspy.LM(model="hosted_vllm/pronoai-R2-32b", api_base="http://20.56.17.12:5000/v1", api_key="",model_provider="openai")
dspy.configure(lm=lm)


class Config:
    FORM_SCHEMA = {
        "idea_title": {
            "description": "A concise, attention-grabbing title for the idea",
            "required": True,
            "max_length": 100
        },
        "solution_details": {
            "description": "Detailed explanation of the proposed solution",
            "required": True,
            "min_length": 50
        },
        "benefits_and_impact": {
            "description": "The potential benefits and impact of implementing this idea",
            "required": True,
            "min_length": 30
        },
        "impact_measures": {
            "description": "How the impact will be measured (KPIs, metrics)",
            "required": True,
            "min_length": 20
        },
        "scalability": {
            "description": "How the solution can be scaled (geographically, demographically)",
            "required": False
        },
        "target_audience": {
            "description": "Primary and secondary audiences who will benefit",
            "required": True
        },
        "relevant_entities": {
            "description": "Other organizations/departments that would need to be involved",
            "required": False
        },
        "feasibility_and_implementation": {
            "description": "Practical considerations for implementation (timeline, resources)",
            "required": True,
            "min_length": 40
        },
        "attachments": {
            "description": "Any supporting documents or references",
            "required": False,
            "type": "file"
        }
    }

class ExtractFormFields(dspy.Signature):
    """Extract all required fields for the idea submission form from unstructured text."""
    idea_description = dspy.InputField(desc="Unstructured description of the idea")
    form_fields = dspy.OutputField(
        desc="""JSON object containing ALL these fields (set to null if missing):
        - idea_title (string|null)
        - solution_details (string|null)
        - benefits_and_impact (string|null)
        - impact_measures (string|null)
        - scalability (string|null)
        - target_audience (string|null)
        - relevant_entities (string|null)
        - feasibility_and_implementation (string|null)
        
        Important: Include ALL fields in output, using null for missing values""",
        prefix="```json\n{\n",
        format=lambda x: json.dumps(
            {field: x.get(field, None) for field in Config.FORM_SCHEMA},
            indent=2
        ) + "\n```"
    )

class IdeaFormProcessor(dspy.Module):
    def __init__(self):
        super().__init__()
        self.extract_fields = dspy.ChainOfThought(ExtractFormFields)
        
    def forward(self, idea_description: str) -> Dict:
        # Get initial extraction with explicit null handling
        extraction = self.extract_fields(idea_description=idea_description)
        
        try:
            # Parse and ensure all fields are present (None if missing)
            raw_fields = json.loads(extraction.form_fields.strip('```').strip())
            return {
                field: raw_fields.get(field, None)
                for field in Config.FORM_SCHEMA
            }
        except json.JSONDecodeError:
            # Return all None if parsing fails
            return {field: None for field in Config.FORM_SCHEMA}
        
    def _validate_field_lengths(self, fields: Dict) -> Dict:
        """Ensure fields meet length requirements"""
        validated = {}
        for field, value in fields.items():
            if field in Config.FORM_SCHEMA:
                config = Config.FORM_SCHEMA[field]
                if isinstance(value, str):
                    if 'max_length' in config and len(value) > config['max_length']:
                        value = value[:config['max_length']-3] + "..."
                    validated[field] = value
        return validated
    

class FormValidator:
    def __init__(self):
        pass
        
    def validate_fields(self, extracted_fields: Dict) -> Dict:
        """Comprehensive validation including content quality checks"""
        results = {
            "missing_fields": [],
            "quality_issues": [],
            "suggestions": []
        }
        
        # Check for missing required fields
        for field, config in Config.FORM_SCHEMA.items():
            if config["required"] and field in extracted_fields:
                if extracted_fields[field] == None:
                    results["missing_fields"].append({
                    "field": field,
                    "message": f"Missing required field: {config['description']}"
                })


            if config["required"] and field not in extracted_fields:
                results["missing_fields"].append({
                    "field": field,
                    "message": f"Missing required field: {config['description']}"
                })
            
        return results
    
    def generate_clarification_prompt(self, validation_results: Dict) -> str:
        """Generate conversational prompt for user"""
        prompt = "To improve your submission:\n"
        
        if validation_results["missing_fields"]:
            prompt += "\nPlease provide:\n"
            for item in validation_results["missing_fields"]:
                prompt += f"- {item['message']}\n"
        
        if validation_results["quality_issues"]:
            prompt += "\nSome areas need more detail:\n"
            for item in validation_results["quality_issues"]:
                prompt += f"- {item['message']}\n"
        
        if validation_results["suggestions"]:
            prompt += "\nSuggestions for improvement:\n"
            for item in validation_results["suggestions"]:
                prompt += f"- {item['message']}\n"
        
        prompt += "\nYou can provide this information by voice or text."
        return prompt

class IterativeIdeaSubmissionAssistant:
    def __init__(self):
        self.validator = FormValidator()
        self.form_processor = IdeaFormProcessor()
        self.clarification_history = []
        
    def _generate_user_prompt(self, validation_results: Dict) -> str:
        """Generate conversational prompt focusing on most critical missing items"""
        prompt = "Let's complete your submission:\n"
        
        # Group by priority (missing fields first, then quality issues)
        if validation_results["missing_fields"]:
            prompt += "\n❌ Missing required information:\n"
            for i, item in enumerate(validation_results["missing_fields"][:3], 1):  # Limit to top 3
                prompt += f"{i}. {Config.FORM_SCHEMA[item['field']]['description']}\n"
        
        if validation_results["quality_issues"]:
            prompt += "\n⚠️ Needs improvement:\n"
            for i, item in enumerate(validation_results["quality_issues"][:2], 1):  # Limit to top 2
                prompt += f"{i}. {item['message']}\n"
        
        prompt += "\nPlease provide this information (you can speak naturally):"
        return prompt
    
    def _update_fields(self, current_fields: Dict, new_input: str) -> Dict:
        """Process new input and merge with existing fields"""
        # Process new input
        new_extraction = self.form_processor(idea_description=new_input)
        
        # Smart merge - only update None fields or fields with quality issues
        updated_fields = current_fields.copy()
        for field in Config.FORM_SCHEMA:
            if field in new_extraction and (
                field not in current_fields 
                or current_fields.get(field) is None
                or len(str(current_fields.get(field, ""))) < 20  # If existing value is very short
            ):
                updated_fields[field] = new_extraction[field]
        
        return updated_fields
    
    def run_interactive_loop(self, transcript: str) -> Dict:
        """Full interactive submission flow"""

        current_fields = self.form_processor(idea_description=transcript)
        validation = self.validator.validate_fields(current_fields)
        
        # Interactive clarification loop
        max_iterations = 3  # Prevent infinite loops

            
        # Get user clarification
        prompt = self._generate_user_prompt(validation)

        return {
            "status": "complete" if not validation["missing_fields"] else "incomplete",
            "form_data": current_fields,
            "validation": validation
            }

# Enhanced Field Validator with progressive strictness
class ProgressiveFormValidator(FormValidator):
    def validate_fields(self, extracted_fields: Dict, iteration: int = 0) -> Dict:
        """Become more strict with each iteration"""
        results = super().validate_fields(extracted_fields)
        
        # After first iteration, enforce minimum lengths more strictly
        if iteration > 0:
            for field, config in Config.FORM_SCHEMA.items():
                if field in extracted_fields and "min_length" in config:
                    if len(extracted_fields[field]) < config["min_length"]:
                        results["quality_issues"].append({
                            "field": field,
                            "message": f"Please provide at least {config['min_length']} characters for {field.replace('_', ' ')}"
                        })
        
        # After second iteration, require metrics in impact measures
        if iteration > 1 and "impact_measures" in extracted_fields:
            if not any(c.isdigit() for c in extracted_fields["impact_measures"]):
                results["quality_issues"].append({
                    "field": "impact_measures",
                    "message": "Please include specific numbers or metrics"
                })
        
        return results

async def transcript(file_path,filename):
    url = "https://fastscribe.tarjama.com/api/asr/"
    payload = {}
    headers = {}


    files=[
        ('file',(filename,open(file_path,'rb'),'application/octet-stream'))
        ]
    print(files)
    response = requests.request("POST", url, headers=headers, data=payload, files=files)
    print(response)

    return response.status_code ,response.json()
