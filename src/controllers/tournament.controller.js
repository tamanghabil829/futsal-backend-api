import { prisma } from "../index.js";
import { createNotification } from "../services/notification.service.js";

// ============================================
// TOURNAMENT CRUD
// ============================================

/**
 * Create a new tournament
 * @route   POST /api/tournaments
 */
export const createTournament = async (req, res) => {
  try {
    const {
      futsalId,
      name,
      description,
      type,
      startDate,
      endDate,
      maxTeams,
      entryFee,
      prizePool,
      rules,
      prizes,
      isPublished,
    } = req.body;

    // Validate required fields
    if (!futsalId || !name || !type || !startDate || !maxTeams) {
      return res.status(400).json({
        status: "error",
        message: "Missing required fields",
      });
    }

    // Verify futsal ownership
    const futsal = await prisma.futsal.findFirst({
      where: {
        id: parseInt(futsalId),
        ownerId: req.user.id,
      },
    });

    if (!futsal) {
      return res.status(404).json({
        status: "error",
        message: "Futsal not found or you do not have permission",
      });
    }

    // Create tournament
    const tournament = await prisma.tournament.create({
      data: {
        futsalId: parseInt(futsalId),
        name,
        description,
        type: type.toUpperCase(),
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        maxTeams: parseInt(maxTeams),
        entryFee: entryFee ? parseFloat(entryFee) : null,
        prizePool: prizePool ? parseFloat(prizePool) : null,
        rules,
        prizes: prizes || [],
        status: "DRAFT",
        isPublished: isPublished || false,
      },
    });

    // Notifications
    try {
      await createNotification({
        userId: req.user.id,
        title: "Tournament Created",
        message: `Your tournament "${tournament.name}" has been created and is in draft.`,
        type: "tournament_created",
        data: { tournamentId: tournament.id },
      });

      const adminUsers = await prisma.user.findMany({
        where: { role: "ADMIN", isActive: true },
        select: { id: true },
      });
      for (const admin of adminUsers) {
        await createNotification({
          userId: admin.id,
          title: "New Tournament Created",
          message: `A new tournament "${tournament.name}" was created by owner ID ${req.user.id}.`,
          type: "admin_tournament_created",
          data: { tournamentId: tournament.id },
        });
      }
    } catch (notifErr) {
      console.error("Notification error:", notifErr);
    }

    res.status(201).json({
      status: "success",
      message: "Tournament created successfully",
      tournament,
    });
  } catch (error) {
    console.error("Create tournament error:", error);
    res.status(500).json({
      status: "error",
      message: "Server error",
    });
  }
};

/**
 * Get all tournaments (public)
 * @route   GET /api/tournaments
 */
export const getAllTournaments = async (req, res) => {
  try {
    const tournaments = await prisma.tournament.findMany({
      include: {
        futsal: {
          // ← THIS MUST BE INCLUDED
          select: {
            id: true,
            name: true,
            ownerId: true, // ← This gives Owner ID
          },
        },
        _count: {
          select: {
            teams: true,
            matches: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    console.log(`📋 Found ${tournaments.length} tournaments`);

    res.json({
      status: "success",
      results: tournaments.length,
      tournaments,
    });
  } catch (error) {
    console.error("Get all tournaments error:", error);
    res.status(500).json({
      status: "error",
      message: "Server error",
    });
  }
};

/**
 * Get owner's tournaments (for dashboard)
 * @route   GET /api/tournaments/my-tournaments
 */
export const getMyTournaments = async (req, res) => {
  try {
    const tournaments = await prisma.tournament.findMany({
      where: {
        futsal: {
          ownerId: req.user.id,
        },
      },
      include: {
        futsal: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            teams: true,
            matches: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json({
      status: "success",
      results: tournaments.length,
      tournaments,
    });
  } catch (error) {
    console.error("Get my tournaments error:", error);
    res.status(500).json({
      status: "error",
      message: "Server error",
    });
  }
};

/**
 * Get tournament by ID
 * @route   GET /api/tournaments/:id
 */
export const getTournamentById = async (req, res) => {
  try {
    const { id } = req.params;

    const tournament = await prisma.tournament.findUnique({
      where: { id: parseInt(id) },
      include: {
        futsal: {
          select: {
            id: true,
            name: true,
            address: true,
            ownerId: true,
          },
        },
        teams: {
          include: {
            players: {
              include: {
                user: {
                  select: {
                    id: true,
                    fullName: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
        matches: {
          include: {
            homeTeam: true,
            awayTeam: true,
          },
          orderBy: {
            matchDate: "asc",
          },
        },
      },
    });

    if (!tournament) {
      return res.status(404).json({
        status: "error",
        message: "Tournament not found",
      });
    }

    res.json({
      status: "success",
      tournament,
    });
  } catch (error) {
    console.error("Get tournament by ID error:", error);
    res.status(500).json({
      status: "error",
      message: "Server error",
    });
  }
};

/**
 * Update tournament
 * @route   PUT /api/tournaments/:id
 */
export const updateTournament = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const tournament = await prisma.tournament.findUnique({
      where: { id: parseInt(id) },
      include: { futsal: true },
    });

    if (!tournament) {
      return res.status(404).json({
        status: "error",
        message: "Tournament not found",
      });
    }

    if (
      tournament.futsal.ownerId !== req.user.id &&
      req.user.role !== "ADMIN"
    ) {
      return res.status(403).json({
        status: "error",
        message: "You do not have permission to update this tournament",
      });
    }

    if (tournament.status !== "DRAFT") {
      delete updates.type;
      delete updates.maxTeams;
      delete updates.startDate;
    }

    const { futsalId, prizes, ...otherUpdates } = updates;
    const updateData = { ...otherUpdates };

    if (prizes === null || prizes === undefined) {
      updateData.prizes = [];
    } else if (Array.isArray(prizes)) {
      updateData.prizes = prizes;
    }

    if (futsalId) {
      updateData.futsal = { connect: { id: parseInt(futsalId) } };
    }

    const updatedTournament = await prisma.tournament.update({
      where: { id: parseInt(id) },
      data: updateData,
    });

    res.json({
      status: "success",
      message: "Tournament updated successfully",
      tournament: updatedTournament,
    });
  } catch (error) {
    console.error("Update tournament error:", error);
    res.status(500).json({
      status: "error",
      message: "Server error",
    });
  }
};

/**
 * Delete tournament
 * @route   DELETE /api/tournaments/:id
 */
export const deleteTournament = async (req, res) => {
  try {
    const { id } = req.params;

    const tournament = await prisma.tournament.findUnique({
      where: { id: parseInt(id) },
      include: { futsal: true, teams: true, matches: true },
    });

    if (!tournament) {
      return res.status(404).json({
        status: "error",
        message: "Tournament not found",
      });
    }

    if (
      tournament.futsal.ownerId !== req.user.id &&
      req.user.role !== "ADMIN"
    ) {
      return res.status(403).json({
        status: "error",
        message: "You do not have permission to delete this tournament",
      });
    }

    if (tournament.status !== "DRAFT") {
      return res.status(400).json({
        status: "error",
        message: "Cannot delete tournament after it has started",
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.match.deleteMany({ where: { tournamentId: parseInt(id) } });
      const teams = await tx.team.findMany({
        where: { tournamentId: parseInt(id) },
      });
      for (const team of teams) {
        await tx.teamMember.deleteMany({ where: { teamId: team.id } });
      }
      await tx.team.deleteMany({ where: { tournamentId: parseInt(id) } });
      await tx.tournament.delete({ where: { id: parseInt(id) } });
    });

    res.json({
      status: "success",
      message: "Tournament deleted successfully",
    });
  } catch (error) {
    console.error("Delete tournament error:", error);
    res.status(500).json({
      status: "error",
      message: "Server error",
    });
  }
};

/**
 * Update tournament status
 * @route   PATCH /api/tournaments/:id/status
 */
export const updateTournamentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ["DRAFT", "ONGOING", "COMPLETED", "CANCELLED"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid status",
      });
    }

    const tournament = await prisma.tournament.findUnique({
      where: { id: parseInt(id) },
      include: { futsal: true },
    });

    if (!tournament) {
      return res.status(404).json({
        status: "error",
        message: "Tournament not found",
      });
    }

    if (
      tournament.futsal.ownerId !== req.user.id &&
      req.user.role !== "ADMIN"
    ) {
      return res.status(403).json({
        status: "error",
        message: "You do not have permission",
      });
    }

    if (tournament.status === "CANCELLED") {
      return res.status(400).json({
        status: "error",
        message: "Cannot change status of a cancelled tournament",
      });
    }

    if (tournament.status === "COMPLETED") {
      return res.status(400).json({
        status: "error",
        message: "Cannot change status of completed tournament",
      });
    }

    const updatedTournament = await prisma.tournament.update({
      where: { id: parseInt(id) },
      data: { status },
    });

    try {
      let message = "";
      if (status === "ONGOING")
        message = `Your tournament "${tournament.name}" is now ongoing.`;
      else if (status === "COMPLETED")
        message = `Your tournament "${tournament.name}" has been completed.`;
      else if (status === "CANCELLED")
        message = `Your tournament "${tournament.name}" has been cancelled.`;

      if (message) {
        await createNotification({
          userId: tournament.futsal.ownerId,
          title: `Tournament ${status}`,
          message,
          type: "tournament_status_changed",
          data: { tournamentId: parseInt(id), status },
        });
      }
    } catch (notifErr) {
      console.error("Notification error:", notifErr);
    }

    res.json({
      status: "success",
      message: `Tournament status updated to ${status}`,
      tournament: updatedTournament,
    });
  } catch (error) {
    console.error("Update tournament status error:", error);
    res.status(500).json({
      status: "error",
      message: "Server error",
    });
  }
};

// ============================================
// PUBLIC ROUTES (from simple controller)
// ============================================

/**
 * Get published tournaments (for home screen)
 * @route   GET /api/tournaments/published
 */
export const getPublishedTournaments = async (req, res) => {
  try {
    const tournaments = await prisma.tournament.findMany({
      where: {
        isPublished: true,
      },
      include: { 
        futsal: { select: { id: true, name: true } },
        _count: { select: { teams: true } }  // ← ADD THIS to get team count
      },
      orderBy: { startDate: "asc" },
    });
    console.log(`📋 Found ${tournaments.length} published tournaments`);
    res.json({ status: "success", tournaments });
  } catch (error) {
    console.error("Get published tournaments error:", error);
    res.status(500).json({ status: "error", message: "Failed to fetch tournaments" });
  }
};

/**
 * Get futsals for dropdown
 * @route   GET /api/tournaments/futsals/dropdown
 */
export const getFutsalsForDropdown = async (req, res) => {
  try {
    const futsals = await prisma.futsal.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    res.json({ status: "success", data: futsals });
  } catch (error) {
    res
      .status(500)
      .json({ status: "error", message: "Failed to fetch futsals" });
  }
};

// ============================================
// TEAM MANAGEMENT
// ============================================

/**
 * Add team to tournament (owner manual)
 * @route   POST /api/tournaments/:tournamentId/teams
 */
export const addTeam = async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const { name, captainName, captainPhone, players, jerseyColor } = req.body;

    const tournament = await prisma.tournament.findUnique({
      where: { id: parseInt(tournamentId) },
      include: { futsal: true },
    });

    if (!tournament) {
      return res.status(404).json({
        status: "error",
        message: "Tournament not found",
      });
    }

    // Updated code (CORRECT)
    const takenSlots = await prisma.team.count({
      where: {
        tournamentId: parseInt(tournamentId),
        status: {
          in: ["PENDING", "APPROVED"],
        },
      },
    });

    if (takenSlots >= tournament.maxTeams) {
      return res.status(400).json({
        status: "error",
        message: "Tournament is full",
      });
    }

    const existingTeam = await prisma.team.findFirst({
      where: {
        tournamentId: parseInt(tournamentId),
        name: name,
      },
    });

    if (existingTeam) {
      return res.status(400).json({
        status: "error",
        message: "Team name already exists",
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const team = await tx.team.create({
        data: {
          tournamentId: parseInt(tournamentId),
          name,
          logo: null,
          status: "APPROVED", // Owner-added teams are auto-approved
        },
      });

      if (captainName) {
        await tx.teamMember.create({
          data: {
            teamId: team.id,
            userId: null,
            role: "CAPTAIN",
            playerName: captainName,
            playerPhone: captainPhone,
            jerseyColor,
          },
        });
      }

      if (players && players.length > 0) {
        for (const player of players) {
          await tx.teamMember.create({
            data: {
              teamId: team.id,
              userId: null,
              role: "PLAYER",
              playerName: player,
            },
          });
        }
      }

      return team;
    });

    try {
      await createNotification({
        userId: tournament.futsal.ownerId,
        title: "New Team Registered",
        message: `Team "${name}" has joined your tournament "${tournament.name}".`,
        type: "team_registered",
        data: { tournamentId: parseInt(tournamentId), teamId: result.id },
      });
    } catch (notifErr) {
      console.error("Notification error:", notifErr);
    }

    res.status(201).json({
      status: "success",
      message: "Team added successfully",
      team: result,
    });
  } catch (error) {
    console.error("Add team error:", error);
    res.status(500).json({
      status: "error",
      message: "Server error",
    });
  }
};

/**
 * Get teams for a tournament
 * @route   GET /api/tournaments/:tournamentId/teams
 */
export const getTeams = async (req, res) => {
  try {
    const { tournamentId } = req.params;

    const teams = await prisma.team.findMany({
      where: { tournamentId: parseInt(tournamentId) },
      include: {
        players: {
          select: {
            id: true,
            role: true,
            playerName: true,
            playerPhone: true,
            jerseyColor: true,
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    res.json({
      status: "success",
      results: teams.length,
      teams,
    });
  } catch (error) {
    console.error("Get teams error:", error);
    res.status(500).json({
      status: "error",
      message: "Server error",
    });
  }
};

/**
 * Update team
 * @route   PUT /api/teams/:teamId
 */
export const updateTeam = async (req, res) => {
  try {
    const { teamId } = req.params;
    const updates = req.body;

    const team = await prisma.team.findUnique({
      where: { id: parseInt(teamId) },
      include: {
        tournament: {
          include: { futsal: true },
        },
      },
    });

    if (!team) {
      return res.status(404).json({
        status: "error",
        message: "Team not found",
      });
    }

    if (
      team.tournament.status !== "DRAFT" &&
      team.tournament.futsal.ownerId !== req.user.id
    ) {
      return res.status(400).json({
        status: "error",
        message: "Cannot update team after tournament has started",
      });
    }

    const updatedTeam = await prisma.team.update({
      where: { id: parseInt(teamId) },
      data: updates,
    });

    res.json({
      status: "success",
      message: "Team updated successfully",
      team: updatedTeam,
    });
  } catch (error) {
    console.error("Update team error:", error);
    res.status(500).json({
      status: "error",
      message: "Server error",
    });
  }
};

/**
 * Delete team
 * @route   DELETE /api/teams/:teamId
 */
export const deleteTeam = async (req, res) => {
  try {
    const { teamId } = req.params;

    const team = await prisma.team.findUnique({
      where: { id: parseInt(teamId) },
      include: {
        tournament: {
          include: { futsal: true },
        },
      },
    });

    if (!team) {
      return res.status(404).json({
        status: "error",
        message: "Team not found",
      });
    }

    if (
      team.tournament.status !== "DRAFT" &&
      team.tournament.futsal.ownerId !== req.user.id
    ) {
      return res.status(400).json({
        status: "error",
        message: "Cannot delete team after tournament has started",
      });
    }

    await prisma.$transaction([
      prisma.teamMember.deleteMany({ where: { teamId: parseInt(teamId) } }),
      prisma.team.delete({ where: { id: parseInt(teamId) } }),
    ]);

    res.json({
      status: "success",
      message: "Team deleted successfully",
    });
  } catch (error) {
    console.error("Delete team error:", error);
    res.status(500).json({
      status: "error",
      message: "Server error",
    });
  }
};

// ============================================
// PLAYER TEAM REGISTRATION
// ============================================

/**
 * Player registers their team for a tournament
 * @route   POST /api/tournaments/:id/register-team
 */
export const registerTeam = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { teamName, captainName, captainPhone, players, jerseyColor } =
      req.body;

    if (!teamName || !captainName || !captainPhone) {
      return res.status(400).json({
        status: "error",
        message: "Team name, captain name, and captain phone are required",
      });
    }

    const phoneRegex = /^98[0-9]{8}$|^97[0-9]{8}$|^96[0-9]{8}$/;
    if (!phoneRegex.test(captainPhone)) {
      return res.status(400).json({
        status: "error",
        message:
          "Invalid phone number. Must be a valid Nepali mobile number (10 digits)",
      });
    }

    const tournament = await prisma.tournament.findUnique({
      where: { id: parseInt(id) },
      include: { futsal: true },
    });

    if (!tournament) {
      return res.status(404).json({
        status: "error",
        message: "Tournament not found",
      });
    }

    if (tournament.status !== "DRAFT") {
      return res.status(400).json({
        status: "error",
        message:
          "Tournament has already started or ended. Registration is closed.",
      });
    }

    if (!tournament.isPublished) {
      return res.status(400).json({
        status: "error",
        message: "Tournament is not open for registration yet",
      });
    }

    // Updated code (CORRECT)
    // Updated code (CORRECT)
    const takenSlots = await prisma.team.count({
      where: {
        tournamentId: parseInt(id),
        status: {
          in: ["PENDING", "APPROVED"],
        },
      },
    });

    if (takenSlots >= tournament.maxTeams) {
      return res.status(400).json({
        status: "error",
        message: "Tournament is full. Maximum teams reached.",
      });
    }

    const existingTeam = await prisma.team.findFirst({
      where: {
        tournamentId: parseInt(id),
        name: teamName,
      },
    });

    if (existingTeam) {
      return res.status(400).json({
        status: "error",
        message:
          "Team name already taken in this tournament. Please choose another name.",
      });
    }

    const existingPlayerTeam = await prisma.team.findFirst({
      where: {
        tournamentId: parseInt(id),
        players: {
          some: {
            userId: userId,
          },
        },
      },
      include: { players: true },
    });

    if (existingPlayerTeam) {
      return res.status(400).json({
        status: "error",
        message: `You are already registered in this tournament with team: ${existingPlayerTeam.name}`,
      });
    }

    let playersList = players || [];
    if (playersList.length < 5) {
      return res.status(400).json({
        status: "error",
        message: "Minimum 5 players required per team (futsal standard)",
      });
    }

    if (playersList.length > 12) {
      return res.status(400).json({
        status: "error",
        message: "Maximum 12 players allowed per team",
      });
    }

    if (playersList.length != new Set(playersList).size) {
      return res.status(400).json({
        status: "error",
        message: "Duplicate player names are not allowed",
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const team = await tx.team.create({
        data: {
          tournamentId: parseInt(id),
          name: teamName,
          logo: null,
          status: "PENDING",
        },
      });

      await tx.teamMember.create({
        data: {
          teamId: team.id,
          userId: userId,
          role: "CAPTAIN",
          playerName: captainName,
          playerPhone: captainPhone,
          jerseyColor: jerseyColor || null,
        },
      });

      for (const playerName of playersList) {
        await tx.teamMember.create({
          data: {
            teamId: team.id,
            userId: null,
            role: "PLAYER",
            playerName: playerName.trim(),
          },
        });
      }

      return team;
    });

    try {
      await createNotification({
        userId: tournament.futsal.ownerId,
        title: "New Team Registration",
        message: `Team "${teamName}" has registered for your tournament "${tournament.name}"`,
        type: "team_registered",
        data: { tournamentId: parseInt(id), teamId: result.id },
      });
    } catch (notifErr) {
      console.error("Notification error:", notifErr);
    }

    res.status(201).json({
      status: "success",
      message:
        "Team registered successfully! The tournament owner will review your registration.",
      team: { id: result.id, name: result.name },
    });
  } catch (error) {
    console.error("Register team error:", error);
    res.status(500).json({
      status: "error",
      message: "Server error. Please try again later.",
    });
  }
};

/**
 * Get player's registered team for a tournament
 * @route   GET /api/tournaments/:id/my-team
 */
export const getMyTeam = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const team = await prisma.team.findFirst({
      where: {
        tournamentId: parseInt(id),
        players: {
          some: {
            userId: userId,
          },
        },
      },
      include: {
        players: {
          select: {
            id: true,
            role: true,
            playerName: true,
            playerPhone: true,
            jerseyColor: true,
          },
        },
      },
    });

    if (!team) {
      return res.json({
        status: "success",
        hasTeam: false,
        team: null,
      });
    }

    res.json({
      status: "success",
      hasTeam: true,
      team: team,
    });
  } catch (error) {
    console.error("Get my team error:", error);
    res.status(500).json({
      status: "error",
      message: "Server error",
    });
  }
};

// ============================================
// TEAM APPROVAL (Owner/Admin)
// ============================================

/**
 * Approve a team registration
 * @route   PATCH /api/teams/:teamId/approve
 */
export const approveTeam = async (req, res) => {
  try {
    const { teamId } = req.params;

    const team = await prisma.team.findUnique({
      where: { id: parseInt(teamId) },
      include: {
        tournament: {
          include: { futsal: true },
        },
        players: true,
      },
    });

    if (!team) {
      return res.status(404).json({
        status: "error",
        message: "Team not found",
      });
    }

    if (
      team.tournament.futsal.ownerId !== req.user.id &&
      req.user.role !== "ADMIN"
    ) {
      return res.status(403).json({
        status: "error",
        message: "You do not have permission to approve this team",
      });
    }

    if (team.tournament.status !== "DRAFT") {
      return res.status(400).json({
        status: "error",
        message: "Cannot approve teams after tournament has started",
      });
    }

    const approvedTeamCount = await prisma.team.count({
      where: {
        tournamentId: team.tournamentId,
        status: "APPROVED",
      },
    });

    if (approvedTeamCount >= team.tournament.maxTeams) {
      return res.status(400).json({
        status: "error",
        message: "Tournament is full. Cannot approve more teams.",
      });
    }

    const updatedTeam = await prisma.team.update({
      where: { id: parseInt(teamId) },
      data: { status: "APPROVED" },
    });

    const captain = team.players.find((p) => p.role === "CAPTAIN");
    if (captain?.userId) {
      try {
        await createNotification({
          userId: captain.userId,
          title: "Team Approved!",
          message: `Your team "${team.name}" has been approved for tournament "${team.tournament.name}".`,
          type: "team_approved",
          data: { tournamentId: team.tournamentId, teamId: team.id },
        });
      } catch (notifErr) {
        console.error("Notification error:", notifErr);
      }
    }

    res.json({
      status: "success",
      message: "Team approved successfully",
      team: updatedTeam,
    });
  } catch (error) {
    console.error("Approve team error:", error);
    res.status(500).json({
      status: "error",
      message: "Server error",
    });
  }
};

/**
 * Reject a team registration
 * @route   PATCH /api/teams/:teamId/reject
 */
export const rejectTeam = async (req, res) => {
  try {
    const { teamId } = req.params;
    const { reason } = req.body;

    const team = await prisma.team.findUnique({
      where: { id: parseInt(teamId) },
      include: {
        tournament: {
          include: { futsal: true },
        },
        players: true,
      },
    });

    if (!team) {
      return res.status(404).json({
        status: "error",
        message: "Team not found",
      });
    }

    if (
      team.tournament.futsal.ownerId !== req.user.id &&
      req.user.role !== "ADMIN"
    ) {
      return res.status(403).json({
        status: "error",
        message: "You do not have permission to reject this team",
      });
    }

    if (team.tournament.status !== "DRAFT") {
      return res.status(400).json({
        status: "error",
        message: "Cannot reject teams after tournament has started",
      });
    }

    const updatedTeam = await prisma.team.update({
      where: { id: parseInt(teamId) },
      data: { status: "REJECTED" },
    });

    const captain = team.players.find((p) => p.role === "CAPTAIN");
    if (captain?.userId) {
      try {
        await createNotification({
          userId: captain.userId,
          title: "Team Registration Update",
          message: reason
            ? `Your team "${team.name}" was rejected for tournament "${team.tournament.name}". Reason: ${reason}`
            : `Your team "${team.name}" was not approved for tournament "${team.tournament.name}".`,
          type: "team_rejected",
          data: { tournamentId: team.tournamentId, teamId: team.id },
        });
      } catch (notifErr) {
        console.error("Notification error:", notifErr);
      }
    }

    res.json({
      status: "success",
      message: "Team rejected successfully",
      team: updatedTeam,
    });
  } catch (error) {
    console.error("Reject team error:", error);
    res.status(500).json({
      status: "error",
      message: "Server error",
    });
  }
};

/**
 * Get teams by status for a tournament
 * @route   GET /api/tournaments/:tournamentId/teams/status/:status
 */
export const getTeamsByStatus = async (req, res) => {
  try {
    const { tournamentId, status } = req.params;
    console.log("📋 getTeamsByStatus called with:", { tournamentId, status });

    const validStatuses = ["PENDING", "APPROVED", "REJECTED"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid status. Use PENDING, APPROVED, or REJECTED",
      });
    }

    // Check if tournament exists
    const tournament = await prisma.tournament.findUnique({
      where: { id: parseInt(tournamentId) },
    });

    if (!tournament) {
      return res.status(404).json({
        status: "error",
        message: "Tournament not found",
      });
    }

    const teams = await prisma.team.findMany({
      where: {
        tournamentId: parseInt(tournamentId),
        status: status,
      },
      include: {
        players: {
          select: {
            id: true,
            role: true,
            playerName: true,
            playerPhone: true,
            userId: true,
          },
        },
      },
      orderBy: {
        id: "asc",  // Changed from createdAt to id
      },
    });

    console.log(`📋 Found ${teams.length} ${status} teams`);

    res.json({
      status: "success",
      results: teams.length,
      teams,
    });
  } catch (error) {
    console.error("Get teams by status error:", error);
    res.status(500).json({
      status: "error",
      message: error.message || "Server error",
    });
  }
};

// ============================================
// FIXTURE MANAGEMENT
// ============================================

/**
 * Generate fixtures for tournament
 * @route   POST /api/tournaments/:tournamentId/generate-fixtures
 */
export const generateFixtures = async (req, res) => {
  try {
    const { tournamentId } = req.params;

    const tournament = await prisma.tournament.findUnique({
      where: { id: parseInt(tournamentId) },
      include: {
        teams: true,
        futsal: true,
      },
    });

    if (!tournament) {
      return res.status(404).json({
        status: "error",
        message: "Tournament not found",
      });
    }

    if (
      tournament.futsal.ownerId !== req.user.id &&
      req.user.role !== "ADMIN"
    ) {
      return res.status(403).json({
        status: "error",
        message: "You do not have permission",
      });
    }

    const existingMatches = await prisma.match.count({
      where: { tournamentId: parseInt(tournamentId) },
    });

    if (existingMatches > 0) {
      return res.status(400).json({
        status: "error",
        message: "Fixtures already generated",
      });
    }

    const approvedTeams = tournament.teams.filter(
      (t) => t.status === "APPROVED",
    );
    const teamCount = approvedTeams.length;

    if (teamCount < 2) {
      return res.status(400).json({
        status: "error",
        message: "Need at least 2 approved teams to generate fixtures",
      });
    }

    let matches = [];
    if (tournament.type === "KNOCKOUT") {
      matches = generateKnockoutFixtures(
        approvedTeams,
        tournament.startDate,
        tournamentId,
      );
    } else {
      matches = generateRoundRobinFixtures(
        approvedTeams,
        tournament.startDate,
        tournamentId,
      );
    }

    await prisma.match.createMany({ data: matches });

    await prisma.tournament.update({
      where: { id: parseInt(tournamentId) },
      data: { status: "ONGOING" },
    });

    try {
      await createNotification({
        userId: tournament.futsal.ownerId,
        title: "Fixtures Generated",
        message: `Fixtures have been generated for "${tournament.name}" and the tournament is now ongoing.`,
        type: "fixtures_generated",
        data: { tournamentId: parseInt(tournamentId) },
      });
    } catch (notifErr) {
      console.error("Notification error:", notifErr);
    }

    res.json({
      status: "success",
      message: "Fixtures generated successfully",
      matchesCount: matches.length,
    });
  } catch (error) {
    console.error("Generate fixtures error:", error);
    res.status(500).json({
      status: "error",
      message: "Server error",
    });
  }
};

const generateKnockoutFixtures = (teams, startDate, tournamentId) => {
  const shuffled = [...teams].sort(() => 0.5 - Math.random());
  const matches = [];
  let matchDate = new Date(startDate);
  const teamCount = teams.length;
  let firstRoundName =
    teamCount === 2
      ? "FINAL"
      : teamCount === 4
        ? "SEMI_FINAL"
        : teamCount === 8
          ? "QUARTER_FINAL"
          : teamCount === 16
            ? "ROUND_OF_16"
            : "QUARTER_FINAL";

  for (let i = 0; i < shuffled.length; i += 2) {
    if (i + 1 < shuffled.length) {
      matches.push({
        tournamentId: parseInt(tournamentId),
        homeTeamId: shuffled[i].id,
        awayTeamId: shuffled[i + 1].id,
        matchDate: new Date(matchDate),
        round: firstRoundName,
        status: "SCHEDULED",
      });
    }
    matchDate.setDate(matchDate.getDate() + 1);
  }
  return matches;
};

const generateRoundRobinFixtures = (teams, startDate, tournamentId) => {
  const matches = [];
  let matchDate = new Date(startDate);
  const numTeams = teams.length;
  for (let i = 0; i < numTeams; i++) {
    for (let j = i + 1; j < numTeams; j++) {
      matches.push({
        tournamentId: parseInt(tournamentId),
        homeTeamId: teams[i].id,
        awayTeamId: teams[j].id,
        matchDate: new Date(matchDate),
        round: "GROUP_STAGE",
        status: "SCHEDULED",
      });
      matchDate.setDate(matchDate.getDate() + 1);
    }
  }
  return matches;
};

/**
 * Get matches for a tournament
 * @route   GET /api/tournaments/:tournamentId/matches
 */
export const getMatches = async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const matches = await prisma.match.findMany({
      where: { tournamentId: parseInt(tournamentId) },
      include: {
        homeTeam: { select: { id: true, name: true } },
        awayTeam: { select: { id: true, name: true } },
      },
      orderBy: { matchDate: "asc" },
    });
    res.json({ status: "success", results: matches.length, matches });
  } catch (error) {
    console.error("Get matches error:", error);
    res.status(500).json({ status: "error", message: "Server error" });
  }
};

/**
 * Update match score
 * @route   PATCH /api/matches/:matchId/score
 */
export const updateMatchScore = async (req, res) => {
  try {
    const { matchId } = req.params;
    const { homeScore, awayScore, homePenalty, awayPenalty } = req.body;

    const match = await prisma.match.findUnique({
      where: { id: parseInt(matchId) },
      include: {
        tournament: { include: { futsal: true } },
      },
    });

    if (!match) {
      return res
        .status(404)
        .json({ status: "error", message: "Match not found" });
    }

    if (
      match.tournament.futsal.ownerId !== req.user.id &&
      req.user.role !== "ADMIN"
    ) {
      return res
        .status(403)
        .json({ status: "error", message: "You do not have permission" });
    }

    const updatedMatch = await prisma.match.update({
      where: { id: parseInt(matchId) },
      data: {
        homeScore,
        awayScore,
        homePenalty,
        awayPenalty,
        status: "COMPLETED",
      },
    });

    const tournament = match.tournament;
    if (tournament.type === "KNOCKOUT" && match.round === "FINAL") {
      await prisma.tournament.update({
        where: { id: tournament.id },
        data: { status: "COMPLETED" },
      });
      try {
        await createNotification({
          userId: tournament.futsal.ownerId,
          title: "Tournament Completed",
          message: `The tournament "${tournament.name}" has finished.`,
          type: "tournament_completed",
          data: { tournamentId: tournament.id },
        });
      } catch (e) {
        console.error("Notification error:", e);
      }
    } else if (tournament.type === "ROUND_ROBIN") {
      const allMatches = await prisma.match.findMany({
        where: { tournamentId: tournament.id },
      });
      const completedCount = allMatches.filter(
        (m) => m.status === "COMPLETED",
      ).length;
      if (completedCount === allMatches.length) {
        await prisma.tournament.update({
          where: { id: tournament.id },
          data: { status: "COMPLETED" },
        });
        try {
          await createNotification({
            userId: tournament.futsal.ownerId,
            title: "Tournament Completed",
            message: `The tournament "${tournament.name}" has finished.`,
            type: "tournament_completed",
            data: { tournamentId: tournament.id },
          });
        } catch (e) {
          console.error("Notification error:", e);
        }
      }
    }

    if (tournament.type === "KNOCKOUT") {
      const roundMatches = await prisma.match.findMany({
        where: { tournamentId: tournament.id, round: match.round },
      });
      const allCompleted = roundMatches.every((m) => m.status === "COMPLETED");
      if (allCompleted) {
        await generateNextRoundMatches(tournament.id, match.round);
      }
    }

    res.json({
      status: "success",
      message: "Score updated successfully",
      match: updatedMatch,
    });
  } catch (error) {
    console.error("Update match score error:", error);
    res.status(500).json({ status: "error", message: "Server error" });
  }
};

const generateNextRoundMatches = async (tournamentId, currentRound) => {
  const completedMatches = await prisma.match.findMany({
    where: { tournamentId, round: currentRound, status: "COMPLETED" },
    include: { homeTeam: true, awayTeam: true },
  });
  const winners = completedMatches
    .map((m) => {
      if (m.homeScore > m.awayScore) return m.homeTeamId;
      if (m.awayScore > m.homeScore) return m.awayTeamId;
      if (m.homePenalty !== null && m.awayPenalty !== null) {
        return m.homePenalty > m.awayPenalty ? m.homeTeamId : m.awayTeamId;
      }
      return null;
    })
    .filter((w) => w !== null);

  if (winners.length < 2) return;
  const nextRound = getNextRound(currentRound);
  if (!nextRound) return;
  const lastDate = new Date(
    Math.max(...completedMatches.map((m) => m.matchDate.getTime())),
  );
  const nextDate = new Date(lastDate.getTime() + 86400000);
  const newMatches = [];
  for (let i = 0; i < winners.length; i += 2) {
    if (i + 1 < winners.length) {
      newMatches.push({
        tournamentId,
        homeTeamId: winners[i],
        awayTeamId: winners[i + 1],
        matchDate: new Date(nextDate.getTime() + (i / 2) * 86400000),
        round: nextRound,
        status: "SCHEDULED",
      });
    }
  }
  if (newMatches.length > 0)
    await prisma.match.createMany({ data: newMatches });
};

const getNextRound = (round) => {
  const map = {
    ROUND_OF_16: "QUARTER_FINAL",
    QUARTER_FINAL: "SEMI_FINAL",
    SEMI_FINAL: "FINAL",
    FINAL: null,
  };
  return map[round] || null;
};

/**
 * Update match status
 * @route   PATCH /api/matches/:matchId/status
 */
export const updateMatchStatus = async (req, res) => {
  try {
    const { matchId } = req.params;
    const { status } = req.body;
    const validStatuses = ["SCHEDULED", "ONGOING", "COMPLETED", "CANCELLED"];
    if (!validStatuses.includes(status)) {
      return res
        .status(400)
        .json({ status: "error", message: "Invalid status" });
    }
    const match = await prisma.match.update({
      where: { id: parseInt(matchId) },
      data: { status },
    });
    res.json({ status: "success", message: "Match status updated", match });
  } catch (error) {
    console.error("Update match status error:", error);
    res.status(500).json({ status: "error", message: "Server error" });
  }
};

// ============================================
// TOURNAMENT STATISTICS
// ============================================

/**
 * Get tournament standings/leaderboard
 * @route   GET /api/tournaments/:tournamentId/standings
 */
export const getTournamentStandings = async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const tournament = await prisma.tournament.findUnique({
      where: { id: parseInt(tournamentId) },
      include: {
        teams: {
          include: {
            homeMatches: { where: { status: "COMPLETED" } },
            awayMatches: { where: { status: "COMPLETED" } },
          },
        },
      },
    });
    if (!tournament) {
      return res
        .status(404)
        .json({ status: "error", message: "Tournament not found" });
    }

    const standings = tournament.teams.map((team) => {
      const allMatches = [...team.homeMatches, ...team.awayMatches];
      const wins = allMatches.filter(
        (m) =>
          (m.homeTeamId === team.id && m.homeScore > m.awayScore) ||
          (m.awayTeamId === team.id && m.awayScore > m.homeScore),
      ).length;
      const draws = allMatches.filter(
        (m) => m.homeScore === m.awayScore,
      ).length;
      const losses = allMatches.length - wins - draws;
      const goalsFor = allMatches.reduce(
        (sum, m) =>
          sum + (m.homeTeamId === team.id ? m.homeScore : m.awayScore),
        0,
      );
      const goalsAgainst = allMatches.reduce(
        (sum, m) =>
          sum + (m.homeTeamId === team.id ? m.awayScore : m.homeScore),
        0,
      );
      return {
        teamId: team.id,
        teamName: team.name,
        played: allMatches.length,
        wins,
        draws,
        losses,
        goalsFor,
        goalsAgainst,
        goalDifference: goalsFor - goalsAgainst,
        points: wins * 3 + draws,
      };
    });
    standings.sort(
      (a, b) =>
        b.points - a.points ||
        b.goalDifference - a.goalDifference ||
        b.goalsFor - a.goalsFor,
    );
    res.json({ status: "success", standings });
  } catch (error) {
    console.error("Get standings error:", error);
    res.status(500).json({ status: "error", message: "Server error" });
  }
};
