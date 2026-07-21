import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROFILE_PATH = path.resolve(__dirname, '../database/profile.json');

const DEFAULT_PROFILE = {
  skills: [
    "Java", "Spring Boot", "SQL", "MySQL", "JavaScript", "HTML", "CSS",
    "Git", "GitHub", "REST APIs", "Node.js", "Problem Solving", "DSA", "OOP"
  ],
  programming_languages: ["Java", "JavaScript", "SQL"],
  frameworks: ["Spring Boot", "Node.js"],
  databases: ["MySQL"],
  tools: ["Git", "GitHub", "REST APIs"],
  preferred_roles: ["Software Engineer", "Backend Developer", "Full Stack Developer"],
  preferred_locations: ["Remote", "Bangalore", "Hybrid"],
  expected_salary: "10 LPA",
  preferred_employment_type: "Full Time",
  years_of_experience: 2,
  education: "Bachelor of Engineering / Technology in Computer Science"
};

export class ProfileService {
  /**
   * Get the current user profile. If it doesn't exist, seed it with defaults first.
   */
  async getProfile() {
    try {
      if (!fs.existsSync(PROFILE_PATH)) {
        logger.info(`Profile file not found at ${PROFILE_PATH}. Seeding with defaults.`, { module: 'profile-service' });
        await this.saveProfile(DEFAULT_PROFILE);
        return DEFAULT_PROFILE;
      }
      const data = fs.readFileSync(PROFILE_PATH, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      logger.error('Failed to read user profile', { module: 'profile-service', error });
      return DEFAULT_PROFILE;
    }
  }

  /**
   * Update the user profile on disk and execute recalculations.
   * @param {Object} updatedProfile Profile data
   * @param {Function|null} onProfileChangeCallback Callback function to run batch recalculations
   */
  async updateProfile(updatedProfile, onProfileChangeCallback = null) {
    try {
      // Validate structure to make sure required fields are present
      const profile = {
        skills: Array.isArray(updatedProfile.skills) ? updatedProfile.skills : [],
        programming_languages: Array.isArray(updatedProfile.programming_languages) ? updatedProfile.programming_languages : [],
        frameworks: Array.isArray(updatedProfile.frameworks) ? updatedProfile.frameworks : [],
        databases: Array.isArray(updatedProfile.databases) ? updatedProfile.databases : [],
        tools: Array.isArray(updatedProfile.tools) ? updatedProfile.tools : [],
        preferred_roles: Array.isArray(updatedProfile.preferred_roles) ? updatedProfile.preferred_roles : [],
        preferred_locations: Array.isArray(updatedProfile.preferred_locations) ? updatedProfile.preferred_locations : [],
        expected_salary: updatedProfile.expected_salary || "Not Specified",
        preferred_employment_type: updatedProfile.preferred_employment_type || "Full Time",
        years_of_experience: Number(updatedProfile.years_of_experience) || 0,
        education: updatedProfile.education || ""
      };

      await this.saveProfile(profile);
      logger.info('User profile updated successfully.', { module: 'profile-service' });

      if (onProfileChangeCallback) {
        // Trigger asynchronous recalculation
        onProfileChangeCallback(profile).catch((err) => {
          logger.error('Failed to trigger background score recalculation', { module: 'profile-service', error: err });
        });
      }

      return profile;
    } catch (error) {
      logger.error('Failed to update user profile', { module: 'profile-service', error });
      throw error;
    }
  }

  /**
   * Internal save helper.
   */
  async saveProfile(profile) {
    const dir = path.dirname(PROFILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(PROFILE_PATH, JSON.stringify(profile, null, 2), 'utf8');
  }
}

export const profileService = new ProfileService();
export default profileService;
