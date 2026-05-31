import { prisma } from '../index.js';

/**
 * Get system settings
 */
export const getSystemSettings = async (req, res) => {
  try {
    // Get settings from database
    let settings = await prisma.systemSettings.findFirst();
    
    // Create default settings if not exist
    if (!settings) {
      settings = await prisma.systemSettings.create({
        data: {
          autoApproveOwners: false,
          autoApproveFutsals: false,
          maintenanceMode: false,
          bookingCancellationHours: 2,
          slotLockMinutes: 5,
          slotGenerationDays: 30,
        }
      });
    }
    
    res.json({ 
      status: 'success', 
      data: settings 
    });
  } catch (error) {
    console.error('Get system settings error:', error);
    res.status(500).json({ 
      status: 'error', 
      message: 'Failed to fetch settings' 
    });
  }
};

/**
 * Update system settings
 */
export const updateSystemSettings = async (req, res) => {
  try {
    const {
      autoApproveOwners,
      autoApproveFutsals,
      maintenanceMode,
      bookingCancellationHours,
      slotLockMinutes,
      slotGenerationDays
    } = req.body;
    
    // Get existing settings
    const existing = await prisma.systemSettings.findFirst();
    
    if (!existing) {
      // Create if not exists
      const settings = await prisma.systemSettings.create({
        data: {
          autoApproveOwners,
          autoApproveFutsals,
          maintenanceMode,
          bookingCancellationHours,
          slotLockMinutes,
          slotGenerationDays,
        }
      });
      return res.json({ status: 'success', data: settings });
    }
    
    // Update existing
    const settings = await prisma.systemSettings.update({
      where: { id: existing.id },
      data: {
        autoApproveOwners,
        autoApproveFutsals,
        maintenanceMode,
        bookingCancellationHours,
        slotLockMinutes,
        slotGenerationDays,
      }
    });
    
    res.json({ 
      status: 'success', 
      message: 'Settings updated successfully',
      data: settings 
    });
  } catch (error) {
    console.error('Update system settings error:', error);
    res.status(500).json({ 
      status: 'error', 
      message: 'Failed to update settings' 
    });
  }
};