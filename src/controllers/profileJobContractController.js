const { Op } = require('sequelize');

const profileJobContractController = {
  getContractId: async (req, res) => {
    const { Contract } = req.app.get('models');
    const { id } = req.params;
    const { id: profileId } = req.profile;
    try {
      const contract = await Contract.findOne({
        where: {
          id,
          [Op.or]: [{ ClientId: profileId }, { ContractorId: profileId }],
        },
        include: ['Client', 'Contractor'],
      });
      if (!contract) return res.status(404).send('Contract not found');
      res.status(200).json({
        success: true,
        contract,
      });
    } catch (error) {
      return res.status(500).send({ error: 'Something went wrong' });
    }
  },

  getContracts: async (req, res) => {
    const { Contract } = req.app.get('models');
    const { id: profileId } = req.profile;
    try {
      const contracts = await Contract.findAll({
        where: {
          [Op.or]: [{ ClientId: profileId }, { ContractorId: profileId }],
          status: { [Op.not]: 'terminated' },
        },
        include: ['Client', 'Contractor'],
      });
      res.status(200).json({
        success: true,
        contracts,
      });
    } catch (error) {
      return res.status(500).send({ error: 'Something went wrong' });
    }
  },

  getJobsUnpaid: async (req, res) => {
    const { Contract, Job } = req.app.get('models');
    const { id: profileId } = req.profile;
    try {
      const jobs = await Job.findAll({
        include: {
          model: Contract,
          where: {
            [Op.or]: [{ ClientId: profileId }, { ContractorId: profileId }],
            status: 'in_progress',
          },
          attributes: [],
        },
      });
      res.status(200).json({
        success: true,
        jobs,
      });
    } catch (error) {
      return res.status(500).send({ error: 'Something went wrong' });
    }
  },

  jobsPaid: async (req, res) => {
    const { Contract, Job, Profile } = req.app.get('models');
    const { job_id } = req.params;
    const { profile } = req;

    const job = await Job.findOne({
      where: { id: job_id },
      include: { model: Contract, where: { ClientId: profile.id } },
    });

    if (!job) return res.status(404).send('Job not found');
    if (job.paid) return res.status(422).send('Job already paid');
    if (profile.balance < job.price)
      return res.status(422).send("You don't have enough money");

    const contractor = await Profile.findOne({
      where: { id: job.Contract.ContractorId },
    });

    const t = await sequelize.transaction();
    try {
      profile.balance -= job.price;
      await profile.save();

      contractor.balance += job.price;
      await contractor.save();

      job.paymentDate = new Date();
      job.paid = true;
      await job.save({ transaction: t });

      await t.commit();

      res.status(201).json({
        sucess: true,
        message: 'Job paid',
        job,
      });
    } catch (error) {
      await t.rollback();
      return res.status(500).send({ error: 'Something went wrong' });
    }
  },

  despositCash: async (req, res) => {
    const { Contract, Job, Profile } = req.app.get('models');
    const { userId } = req.params;
    const { profile } = req;

    const client = await Profile.findOne({
      where: { id: userId, type: 'client' },
    });

    if (!client) return res.status(404).send('Client not found');

    const totalPrice = await Job.sum('price', {
      include: {
        model: Contract,
        where: { ClientId: profile.id, status: 'in_progress' },
      },
    });
    const deposit = totalPrice * (25 / 100);
    const { amount } = req.body;
    if (amount < deposit) return res.status(422).send('Not enough money');

    if (deposit < amount)
      return res
        .status(422)
        .send("You can't deposit more than 25% of your total price");

    const t = await sequelize.transaction();
    try {
      client.balance += amount;
      await client.save({ transaction: t });

      await t.commit();

      res.status(201).json({
        sucess: true,
        message: 'Cash deposited',
        client,
      });
    } catch (error) {
      return res.status(500).send({ error: 'Something went wrong' });
    }
  },

  getBestProfession: async (req, res) => {
    const { Contract, Job, Profile } = req.app.get('models');
    const { start, end } = req.query;
    const { id: profileId } = req.profile;

    try {
      const bestProfession = await Job.findOne({
        where: {
          ContractorId: profileId,
          paid: true,
          ...(start &&
            end && {
              paymentDate: {
                [Op.gte]: start,
                [Op.lte]: end,
              },
            }),
        },
        attributes: [[sequelize.fn('sum', sequelize.col('price')), 'profit']],
        group: 'Contract.Contractor.profession',
        order: [[sequelize.col('profit'), 'DESC']],
        include: [
          {
            model: Contract,
            required: true,
            include: [
              {
                model: Profile,
                as: 'Contractor',
                attributes: ['profession'],
                required: true,
              },
            ],
          },
        ],
      });

      if (!bestProfession) return res.status(404).send('No best profession');
      res.status(200).json({
        success: true,
        profession: bestProfession.Contract.Contractor.profession,
        profit: bestProfession.get('profit'),
      });
    } catch (error) {
      return res.status(500).send({ error: 'Something went wrong' });
    }
  },

  getBestClients: async (req, res) => {
    const { Contract, Job, Profile } = req.app.get('models');
    const { start, end, limit = 2 } = req.query;
    const { id: profileId } = req.profile;

    try {
      const bestClients = await Job.findAll({
        attributes: [
          [sequelize.fn('sum', sequelize.col('price')), 'totalPayments'],
        ],
        where: {
          ClientId: profileId,
          paid: true,
          ...(start &&
            end && {
              paymentDate: {
                [Op.gte]: start,
                [Op.lte]: end,
              },
            }),
        },
        group: 'Contract.Client.id',
        order: [[sequelize.col('totalPayments'), 'DESC']],
        limit,
        include: [
          {
            model: Contract,
            required: true,
            include: [
              {
                model: Profile,
                as: 'Client',
                required: true,
              },
            ],
          },
        ],
      });

      if (!bestClients) return res.status(404).send('No best clients');
      const clients = bestClients.map((obj) => ({
        id: obj.Contract.Client.id,
        fullName: [
          obj.Contract.Client.firstName,
          obj.Contract.Client.lastName,
        ].join(' '),
        totalPayments: obj.get('totalPayments'),
      }));
      res.status(200).json({
        success: true,
        clients,
      });
    } catch (error) {
      return res.status(500).send({ error: 'Something went wrong' });
    }
  },
};

module.exports = profileJobContractController;
