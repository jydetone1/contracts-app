const router = require('express').Router();
const { getProfile } = require('../middleware/getProfile');
const ProfileJobContractController = require('../controllers/ProfileJobContractController');

router.get(
  '/contracts/:id',
  getProfile,
  ProfileJobContractController.getContractId
);

router.get('/contracts', ProfileJobContractController.getContracts);

router.get(
  '/jobs/unpaid',
  getProfile,
  ProfileJobContractController.getJobsUnpaid
);

router.post(
  '/jobs/:job_id/pay',
  getProfile,
  ProfileJobContractController.jobsPaid
);

router.post(
  '/balances/deposit/:userId',
  getProfile,
  ProfileJobContractController.despositCash
);

router.get(
  '/admin/best-profession',
  getProfile,
  ProfileJobContractController.getBestProfession
);

router.get(
  '/admin/best-clients',
  getProfile,
  ProfileJobContractController.getBestClients
);

module.exports = router;
