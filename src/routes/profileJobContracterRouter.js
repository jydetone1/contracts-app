const router = require('express').Router();
const { getProfile } = require('../middleware/getProfile');
const profileJobContractController = require('../controllers/profileJobContractController');

router.get(
  '/contracts/:id',
  getProfile,
  profileJobContractController.getContractId
);

router.get('/contracts', getProfile, profileJobContractController.getContracts);

router.get(
  '/jobs/unpaid',
  getProfile,
  profileJobContractController.getJobsUnpaid
);

router.post(
  '/jobs/:job_id/pay',
  getProfile,
  profileJobContractController.jobsPaid
);

router.post(
  '/balances/deposit/:userId',
  getProfile,
  profileJobContractController.despositCash
);

router.get(
  '/admin/best-profession',
  getProfile,
  profileJobContractController.getBestProfession
);

router.get(
  '/admin/best-clients',
  getProfile,
  profileJobContractController.getBestClients
);

module.exports = router;
