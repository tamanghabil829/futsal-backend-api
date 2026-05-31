import { Router } from 'express';
import {
  // Tournament CRUD
  createTournament,
  getAllTournaments,
  getMyTournaments,
  getTournamentById,
  updateTournament,
  deleteTournament,
  updateTournamentStatus,
  
  // Team Management
  addTeam,
  getTeams,
  updateTeam,
  deleteTeam,
  
  // Fixture Generation
  generateFixtures,
  getMatches,
  updateMatchScore,
  updateMatchStatus,
  
  // Statistics
  getTournamentStandings,
  
  // Player Registration
  registerTeam,
  getMyTeam,
  
  // Team Approval
  approveTeam,
  rejectTeam,
  getTeamsByStatus,
  
  // Public/Special
  getPublishedTournaments,
  getFutsalsForDropdown,
} from '../controllers/tournament.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

// ============================================
// PUBLIC ROUTES (no authentication required)
// ============================================

/**
 * @route   GET /api/tournaments
 * @desc    Get all published tournaments (public view)
 * @access  Public
 */
router.get('/', getAllTournaments);

/**
 * @route   GET /api/tournaments/published
 * @desc    Get published tournaments for home screen
 * @access  Public
 */
router.get('/published', getPublishedTournaments);

// ============================================
// IMPORTANT: Specific routes MUST come BEFORE parameter routes
// ============================================

/**
 * @route   GET /api/tournaments/my-tournaments
 * @desc    Get owner's tournaments (for dashboard)
 * @access  Private (Owner/Admin)
 */
router.get('/my-tournaments', authenticate, authorize('OWNER', 'ADMIN'), getMyTournaments);

/**
 * @route   GET /api/tournaments/futsals/dropdown
 * @desc    Get futsals for dropdown (for tournament creation)
 * @access  Private (Owner/Admin)
 */
router.get('/futsals/dropdown', authenticate, authorize('OWNER', 'ADMIN'), getFutsalsForDropdown);

// ============================================
// PARAMETER ROUTES (/:id) - MUST COME LAST
// ============================================

/**
 * @route   GET /api/tournaments/:id
 * @desc    Get tournament by ID
 * @access  Public
 */
router.get('/:id', getTournamentById);

/**
 * @route   GET /api/tournaments/:tournamentId/teams
 * @desc    Get teams for a tournament
 * @access  Public
 */
router.get('/:tournamentId/teams', getTeams);

/**
 * @route   GET /api/tournaments/:tournamentId/matches
 * @desc    Get matches for a tournament
 * @access  Public
 */
router.get('/:tournamentId/matches', getMatches);

/**
 * @route   GET /api/tournaments/:tournamentId/standings
 * @desc    Get tournament standings/leaderboard
 * @access  Public
 */
router.get('/:tournamentId/standings', getTournamentStandings);

// ============================================
// AUTHENTICATED ROUTES (any logged-in user)
// ============================================

/**
 * @route   POST /api/tournaments/:id/register-team
 * @desc    Player registers their team for a tournament
 * @access  Private (any authenticated user)
 */
router.post('/:id/register-team', authenticate, registerTeam);

/**
 * @route   GET /api/tournaments/:id/my-team
 * @desc    Get player's registered team for a tournament
 * @access  Private (any authenticated user)
 */
router.get('/:id/my-team', authenticate, getMyTeam);

// ============================================
// OWNER/ADMIN ONLY ROUTES
// ============================================

/**
 * @route   POST /api/tournaments
 * @desc    Create a new tournament
 * @access  Private (Owner/Admin)
 */
router.post('/', authenticate, authorize('OWNER', 'ADMIN'), createTournament);

/**
 * @route   PUT /api/tournaments/:id
 * @desc    Update tournament
 * @access  Private (Owner/Admin)
 */
router.put('/:id', authenticate, authorize('OWNER', 'ADMIN'), updateTournament);

/**
 * @route   DELETE /api/tournaments/:id
 * @desc    Delete tournament
 * @access  Private (Owner/Admin)
 */
router.delete('/:id', authenticate, authorize('OWNER', 'ADMIN'), deleteTournament);

/**
 * @route   PATCH /api/tournaments/:id/status
 * @desc    Update tournament status
 * @access  Private (Owner/Admin)
 */
router.patch('/:id/status', authenticate, authorize('OWNER', 'ADMIN'), updateTournamentStatus);

// ============================================
// TEAM MANAGEMENT (Owner/Admin)
// ============================================

/**
 * @route   POST /api/tournaments/:tournamentId/teams
 * @desc    Add team to tournament (manual by owner)
 * @access  Private (Owner/Admin)
 */
router.post('/:tournamentId/teams', authenticate, authorize('OWNER', 'ADMIN'), addTeam);

/**
 * @route   PUT /api/teams/:teamId
 * @desc    Update team
 * @access  Private (Owner/Admin)
 */
router.put('/teams/:teamId', authenticate, authorize('OWNER', 'ADMIN'), updateTeam);

/**
 * @route   DELETE /api/teams/:teamId
 * @desc    Delete team
 * @access  Private (Owner/Admin)
 */
router.delete('/teams/:teamId', authenticate, authorize('OWNER', 'ADMIN'), deleteTeam);

// ============================================
// TEAM APPROVAL ROUTES (Owner/Admin)
// ============================================

/**
 * @route   PATCH /api/teams/:teamId/approve
 * @desc    Approve a pending team registration
 * @access  Private (Owner/Admin)
 */
router.patch('/teams/:teamId/approve', authenticate, authorize('OWNER', 'ADMIN'), approveTeam);

/**
 * @route   PATCH /api/teams/:teamId/reject
 * @desc    Reject a pending team registration
 * @access  Private (Owner/Admin)
 */
router.patch('/teams/:teamId/reject', authenticate, authorize('OWNER', 'ADMIN'), rejectTeam);

/**
 * @route   GET /api/tournaments/:tournamentId/teams/status/:status
 * @desc    Get teams by status (PENDING, APPROVED, REJECTED)
 * @access  Private (Owner/Admin)
 */
router.get('/:tournamentId/teams/status/:status', authenticate, authorize('OWNER', 'ADMIN'), getTeamsByStatus);

// ============================================
// FIXTURE ROUTES (Owner/Admin)
// ============================================

/**
 * @route   POST /api/tournaments/:tournamentId/generate-fixtures
 * @desc    Generate fixtures for tournament
 * @access  Private (Owner/Admin)
 */
router.post('/:tournamentId/generate-fixtures', authenticate, authorize('OWNER', 'ADMIN'), generateFixtures);

/**
 * @route   PATCH /api/matches/:matchId/score
 * @desc    Update match score
 * @access  Private (Owner/Admin)
 */
router.patch('/matches/:matchId/score', authenticate, authorize('OWNER', 'ADMIN'), updateMatchScore);

/**
 * @route   PATCH /api/matches/:matchId/status
 * @desc    Update match status
 * @access  Private (Owner/Admin)
 */
router.patch('/matches/:matchId/status', authenticate, authorize('OWNER', 'ADMIN'), updateMatchStatus);

export default router;